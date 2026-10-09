-- Migration 14_clans.sql

CREATE TYPE public.clan_role AS ENUM ('MEMBER', 'OFFICER', 'LEADER');
CREATE TYPE public.clan_status AS ENUM ('ACTIVE', 'DISBANDED');
CREATE TYPE public.clan_invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

CREATE TABLE public.clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(name) >= 3 AND length(name) <= 30),
  tag text NOT NULL UNIQUE CHECK (length(tag) >= 2 AND length(tag) <= 5),
  description text NOT NULL CHECK (length(description) <= 500),
  creator_id uuid NOT NULL REFERENCES public.players(id),
  status public.clan_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active clans" ON public.clans FOR SELECT TO public USING (status = 'ACTIVE');

CREATE TABLE public.clan_members (
  clan_id uuid NOT NULL REFERENCES public.clans(id),
  player_id uuid NOT NULL REFERENCES public.players(id),
  role public.clan_role NOT NULL DEFAULT 'MEMBER',
  joined_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (clan_id, player_id),
  UNIQUE (player_id) -- one clan per player constraint
);

ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view clan members" ON public.clan_members FOR SELECT TO public USING (
  EXISTS (SELECT 1 FROM public.clans c WHERE c.id = clan_id AND c.status = 'ACTIVE')
);

CREATE TABLE public.clan_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id),
  inviter_id uuid NOT NULL REFERENCES public.players(id),
  invitee_id uuid NOT NULL REFERENCES public.players(id),
  status public.clan_invitation_status NOT NULL DEFAULT 'PENDING',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Ensure we don't have multiple pending invites for the same user and clan
CREATE UNIQUE INDEX idx_unique_pending_clan_invite ON public.clan_invitations (clan_id, invitee_id) WHERE status = 'PENDING';

ALTER TABLE public.clan_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own invites" ON public.clan_invitations FOR SELECT TO public USING (
  invitee_id = auth.uid() OR inviter_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.clan_members m WHERE m.clan_id = public.clan_invitations.clan_id AND m.player_id = auth.uid())
);


-- RPC: create_clan
CREATE OR REPLACE FUNCTION public.create_clan(p_name text, p_tag text, p_description text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player public.players%ROWTYPE;
  v_clan_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT * INTO v_player FROM public.players WHERE id = v_uid FOR UPDATE;
  IF v_player.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Only ACTIVE players can create clans';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.clan_members WHERE player_id = v_uid) THEN
    RAISE EXCEPTION 'You are already in a clan';
  END IF;
  
  INSERT INTO public.clans (name, tag, description, creator_id, status)
  VALUES (p_name, p_tag, p_description, v_uid, 'ACTIVE')
  RETURNING id INTO v_clan_id;
  
  INSERT INTO public.clan_members (clan_id, player_id, role)
  VALUES (v_clan_id, v_uid, 'LEADER');
  
  RETURN v_clan_id;
END;
$$;


-- RPC: invite_to_clan
CREATE OR REPLACE FUNCTION public.invite_to_clan(p_invitee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inviter_member public.clan_members%ROWTYPE;
  v_invitee public.players%ROWTYPE;
  v_clan public.clans%ROWTYPE;
  v_member_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_inviter_member FROM public.clan_members WHERE player_id = v_uid;
  IF v_inviter_member.clan_id IS NULL THEN RAISE EXCEPTION 'You are not in a clan'; END IF;
  IF v_inviter_member.role NOT IN ('LEADER', 'OFFICER') THEN
    RAISE EXCEPTION 'Only officers and leaders can invite players';
  END IF;

  SELECT * INTO v_clan FROM public.clans WHERE id = v_inviter_member.clan_id;
  IF v_clan.status != 'ACTIVE' THEN RAISE EXCEPTION 'Clan is not active'; END IF;

  SELECT COUNT(*) INTO v_member_count FROM public.clan_members WHERE clan_id = v_clan.id;
  IF v_member_count >= 50 THEN RAISE EXCEPTION 'Clan is full (max 50 members)'; END IF;

  SELECT * INTO v_invitee FROM public.players WHERE id = p_invitee_id;
  IF v_invitee.id IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF v_invitee.status != 'ACTIVE' THEN RAISE EXCEPTION 'Player is not active'; END IF;

  IF EXISTS (SELECT 1 FROM public.clan_members WHERE player_id = p_invitee_id) THEN
    RAISE EXCEPTION 'Player is already in a clan';
  END IF;

  INSERT INTO public.clan_invitations (clan_id, inviter_id, invitee_id, status)
  VALUES (v_clan.id, v_uid, p_invitee_id, 'PENDING');
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Player already has a pending invitation to this clan';
END;
$$;


-- RPC: respond_to_clan_invitation
CREATE OR REPLACE FUNCTION public.respond_to_clan_invitation(p_invitation_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite public.clan_invitations%ROWTYPE;
  v_player public.players%ROWTYPE;
  v_clan public.clans%ROWTYPE;
  v_member_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.clan_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_invite.invitee_id != v_uid THEN RAISE EXCEPTION 'Not your invitation'; END IF;
  IF v_invite.status != 'PENDING' THEN RAISE EXCEPTION 'Invitation is no longer pending'; END IF;

  SELECT * INTO v_player FROM public.players WHERE id = v_uid FOR UPDATE;
  IF v_player.status != 'ACTIVE' THEN RAISE EXCEPTION 'Only ACTIVE players can join clans'; END IF;

  IF NOT p_accept THEN
    UPDATE public.clan_invitations SET status = 'DECLINED', updated_at = now() WHERE id = p_invitation_id;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.clan_members WHERE player_id = v_uid) THEN
    UPDATE public.clan_invitations SET status = 'CANCELLED', updated_at = now() WHERE id = p_invitation_id;
    RAISE EXCEPTION 'You are already in a clan';
  END IF;

  SELECT * INTO v_clan FROM public.clans WHERE id = v_invite.clan_id FOR UPDATE;
  IF v_clan.status != 'ACTIVE' THEN RAISE EXCEPTION 'Clan is not active'; END IF;

  SELECT COUNT(*) INTO v_member_count FROM public.clan_members WHERE clan_id = v_clan.id;
  IF v_member_count >= 50 THEN RAISE EXCEPTION 'Clan is full (max 50 members)'; END IF;

  INSERT INTO public.clan_members (clan_id, player_id, role)
  VALUES (v_clan.id, v_uid, 'MEMBER');

  UPDATE public.clan_invitations SET status = 'ACCEPTED', updated_at = now() WHERE id = p_invitation_id;
  
  -- Cancel any other pending invitations for this user
  UPDATE public.clan_invitations SET status = 'CANCELLED', updated_at = now() 
  WHERE invitee_id = v_uid AND status = 'PENDING';
END;
$$;


-- RPC: cancel_clan_invitation
CREATE OR REPLACE FUNCTION public.cancel_clan_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite public.clan_invitations%ROWTYPE;
  v_inviter_member public.clan_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.clan_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_invite.status != 'PENDING' THEN RAISE EXCEPTION 'Invitation is no longer pending'; END IF;

  SELECT * INTO v_inviter_member FROM public.clan_members WHERE player_id = v_uid AND clan_id = v_invite.clan_id;
  IF v_inviter_member.clan_id IS NULL OR v_inviter_member.role NOT IN ('LEADER', 'OFFICER') THEN
    IF v_invite.inviter_id != v_uid THEN
      RAISE EXCEPTION 'Not authorized to cancel this invitation';
    END IF;
  END IF;

  UPDATE public.clan_invitations SET status = 'CANCELLED', updated_at = now() WHERE id = p_invitation_id;
END;
$$;


-- RPC: leave_clan
CREATE OR REPLACE FUNCTION public.leave_clan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_member public.clan_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_member FROM public.clan_members WHERE player_id = v_uid FOR UPDATE;
  IF v_member.clan_id IS NULL THEN RAISE EXCEPTION 'You are not in a clan'; END IF;

  IF v_member.role = 'LEADER' THEN
    RAISE EXCEPTION 'Leader cannot leave without transferring leadership or disbanding';
  END IF;

  DELETE FROM public.clan_members WHERE player_id = v_uid;
END;
$$;


-- RPC: remove_clan_member
CREATE OR REPLACE FUNCTION public.remove_clan_member(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_remover public.clan_members%ROWTYPE;
  v_target public.clan_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_uid = p_player_id THEN RAISE EXCEPTION 'Use leave_clan instead'; END IF;

  SELECT * INTO v_remover FROM public.clan_members WHERE player_id = v_uid;
  IF v_remover.clan_id IS NULL THEN RAISE EXCEPTION 'You are not in a clan'; END IF;

  SELECT * INTO v_target FROM public.clan_members WHERE player_id = p_player_id FOR UPDATE;
  IF v_target.clan_id IS NULL OR v_target.clan_id != v_remover.clan_id THEN 
    RAISE EXCEPTION 'Player is not in your clan'; 
  END IF;

  IF v_target.role = 'LEADER' THEN
    RAISE EXCEPTION 'Cannot remove the clan leader';
  END IF;

  IF v_remover.role = 'MEMBER' THEN
    RAISE EXCEPTION 'Not authorized to remove members';
  END IF;
  
  IF v_remover.role = 'OFFICER' AND v_target.role IN ('LEADER', 'OFFICER') THEN
    RAISE EXCEPTION 'Officers can only remove members';
  END IF;

  DELETE FROM public.clan_members WHERE player_id = p_player_id;
END;
$$;


-- RPC: transfer_clan_leadership
CREATE OR REPLACE FUNCTION public.transfer_clan_leadership(p_new_leader_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current_leader public.clan_members%ROWTYPE;
  v_new_leader public.clan_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_current_leader FROM public.clan_members WHERE player_id = v_uid FOR UPDATE;
  IF v_current_leader.clan_id IS NULL OR v_current_leader.role != 'LEADER' THEN 
    RAISE EXCEPTION 'You are not the clan leader'; 
  END IF;

  SELECT * INTO v_new_leader FROM public.clan_members WHERE player_id = p_new_leader_id FOR UPDATE;
  IF v_new_leader.clan_id IS NULL OR v_new_leader.clan_id != v_current_leader.clan_id THEN
    RAISE EXCEPTION 'Target player is not in your clan';
  END IF;

  UPDATE public.clan_members SET role = 'OFFICER' WHERE player_id = v_uid;
  UPDATE public.clan_members SET role = 'LEADER' WHERE player_id = p_new_leader_id;
END;
$$;


-- RPC: disband_clan
CREATE OR REPLACE FUNCTION public.disband_clan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_leader public.clan_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_leader FROM public.clan_members WHERE player_id = v_uid FOR UPDATE;
  IF v_leader.clan_id IS NULL OR v_leader.role != 'LEADER' THEN 
    RAISE EXCEPTION 'Only the clan leader can disband the clan'; 
  END IF;

  -- Remove all members
  DELETE FROM public.clan_members WHERE clan_id = v_leader.clan_id;

  -- Cancel pending invites
  UPDATE public.clan_invitations SET status = 'CANCELLED', updated_at = now() 
  WHERE clan_id = v_leader.clan_id AND status = 'PENDING';

  -- Mark clan as disbanded
  UPDATE public.clans SET status = 'DISBANDED', updated_at = now() WHERE id = v_leader.clan_id;
END;
$$;
