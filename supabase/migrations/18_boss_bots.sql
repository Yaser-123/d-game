-- Migration: 18_boss_bots.sql
INSERT INTO public.players (id, handle, points, status)
VALUES 
('11111111-1111-4111-8111-111111111111', 'The Hollow Knight', 99999, 'ACTIVE'),
('22222222-2222-4222-8222-222222222222', 'The Phantom', 99999, 'ACTIVE'),
('33333333-3333-4333-8333-333333333333', 'The Executioner', 99999, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;
