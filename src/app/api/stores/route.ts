import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-clients/server';

export async function POST(request: Request) {
  try {
    const { name, address, kra_pin, vat_number, kra_token, etims_username, etims_password } = await request.json();
    const supabase = await createClient();

    const insertData: any = { name, address };
    if (kra_pin) insertData.kra_pin = kra_pin;
    if (vat_number) insertData.vat_number = vat_number;
    if (kra_token) insertData.kra_token = kra_token;
    if (etims_username) insertData.etims_username = etims_username;
    if (etims_password) insertData.etims_password = etims_password;
    const { data, error } = await supabase
      .from('stores')
      .insert([insertData])
      .select('id, name, address, kra_pin, vat_number, kra_token, etims_username, etims_password')
      .single();

    if (error) throw error;

    return NextResponse.json({ store_id: data.id, ...data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('stores')
      .select('*');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 