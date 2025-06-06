import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';
import { cookies } from 'next/headers';

interface ApiError {
  message: string;
  status?: number;
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { email, role, store_id, invited_by } = await request.json();

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .insert([{
        email,
        role,
        store_id,
        invited_by,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
      }])
      .select()
      .single();

    if (inviteError) throw inviteError;

    // Generate invitation token
    const invitationToken = Buffer.from(JSON.stringify({
      invitation_id: invitation.id,
      email,
      store_id,
      role
    })).toString('base64');

    // TODO: Send invitation email with the token
    // For now, we'll just return the token
    return NextResponse.json({ 
      invitation_id: invitation.id,
      token: invitationToken 
    });
  } catch (error: unknown) {
    const apiError = error as ApiError;
    return NextResponse.json(
      { error: apiError.message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Decode and verify token
    const decodedToken = JSON.parse(Buffer.from(token, 'base64').toString());
    
    const { data: invitation, error } = await supabase
      .from('invitations')
      .select('*, stores(name)')
      .eq('id', decodedToken.invitation_id)
      .single();

    if (error) throw error;

    if (!invitation || invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 400 }
      );
    }

    return NextResponse.json(invitation);
  } catch (error: unknown) {
    const apiError = error as ApiError;
    return NextResponse.json(
      { error: apiError.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { invitation_id, status } = await request.json();

    const { data, error } = await supabase
      .from('invitations')
      .update({ status })
      .eq('id', invitation_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = error as ApiError;
    return NextResponse.json(
      { error: apiError.message },
      { status: 500 }
    );
  }
} 