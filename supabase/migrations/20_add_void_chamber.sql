-- Migration: 20_add_void_chamber.sql

ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'VOID_CHAMBER';
