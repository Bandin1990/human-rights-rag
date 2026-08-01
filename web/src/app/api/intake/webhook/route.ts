import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // In a real system, we would:
    // 1. Validate channel credentials/signature
    // 2. Check for idempotency (external_id)
    // 3. Insert into case_management.intake_messages
    // 4. Trigger processing job
    
    // Mock processing for Phase 1
    console.log('Received intake webhook payload:', payload);

    return NextResponse.json({
      status: 'success',
      message: 'Intake message received and queued for processing.',
      mock_message_id: crypto.randomUUID(),
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Invalid payload' },
      { status: 400 }
    );
  }
}
