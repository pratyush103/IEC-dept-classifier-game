import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { logToGoogleSheets } from '../../../lib/googleSheets';

// Function to convert basic Markdown formatting to HTML
function markdownToHtml(text: string): string {
  return text
    // Convert **bold** to <strong>bold</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Convert *italic* to <em>italic</em>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Convert line breaks to <br> tags
    .replace(/\n/g, '<br>')
    // Convert numbered lists (1. item) to HTML lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Wrap list items in <ol> tags
    .replace(/(<li>.*<\/li>)/g, '<ol>$1</ol>')
    // Convert bullet points (- item or * item) to HTML lists
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    // Clean up any double ol tags
    .replace(/<\/ol>\s*<ol>/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, department, description } = await req.json();

    if (!name || !email || !phone || !department || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Log to Google Sheets (if configured)
    try {
      await logToGoogleSheets({
        name,
        email,
        phone,
        department,
        description
      });
      
    } catch (sheetsError) {
      console.error('Error logging to Google Sheets:', sheetsError);
      // Don't fail the entire request if Google Sheets fails
    }

    // Send email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
      secure: true, // Use TLS
      port: 465,
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError);
      return NextResponse.json({ 
        error: 'Email configuration error. Please check your email server settings.',
        details: verifyError instanceof Error ? verifyError.message : 'SMTP verification failed'
      }, { status: 500 });
    }

    // Convert Markdown formatting in description to HTML
    const htmlDescription = markdownToHtml(description);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your IEC Department Match: ${department}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff7f2e 0%, #28359e 50%, #0f0f3a 100%); padding: 30px; text-align: center;">
            <div style="margin-bottom: 20px;">
              <img src="https://i.ibb.co/rGpmZnsH/iec-logo.png" alt="IEC Logo" style="width: 200px; height: auto; display: block; margin: 0 auto; border: 0;">
            </div>
            <h1 style="color: white; margin: 0; font-size: 24px;">IEC Department Classification Results</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${name}!</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;">
              <h3 style="color: #28359e; margin-top: 0;">Your Perfect Department Match:</h3>
              <h2 style="color: #333; font-size: 28px; margin: 10px 0;">${department}</h2>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #28359e; margin-top: 0;">Why This Department is Perfect for You:</h3>
              <p style="color: #555; line-height: 1.6; margin-bottom: 0;">${htmlDescription}</p>
            </div>
            
            <div style="margin-top: 30px; padding: 20px; background-color: #e8f2ff; border-radius: 8px; border-left: 4px solid #28359e;">
              <p style="margin: 0; color: #333; font-size: 14px;">
                <strong>Next Steps:</strong> Connect with the ${department} department to learn more about opportunities, 
                projects, and how you can get involved. Your skills and interests align perfectly with what they're looking for!
              </p>
            </div>
            
            <div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #ff7f2e 0%, #28359e 50%, #0f0f3a 100%); border-radius: 8px; text-align: center;">
              <h3 style="color: white; margin-top: 0; margin-bottom: 15px;">🚀 Take the Next Step!</h3>
              <p style="color: white; margin-bottom: 20px; font-size: 14px;">
                Ready to join the IEC Executive Team? Apply for an executive position and help shape the future of our community!
              </p>
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSeKWN_DaG_4IZPdYt-pJNYs_0-QgvviTX_Tgkod58TAOQTsYA/viewform" 
                style="display: inline-block; background-color: white; color: #28359e; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px; transition: all 0.3s ease;">
                Apply for Executive Position
              </a>
            </div>
          </div>
          
          <div style="background-color: #333; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">Thank you for taking the IEC Department Classification Quiz!</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #ccc;">This email was sent to: ${email}</p>
          </div>
        </div>
      `,
    };


    try {
      await transporter.sendMail(mailOptions);
      
      // ...admin notification email removed as requested...
      
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      return NextResponse.json({ 
        error: 'Failed to send email. Please check your email configuration.',
        details: emailError instanceof Error ? emailError.message : 'Unknown email error'
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Email sent successfully' 
    });
  } catch (error) {
    console.error('Error in send-email API:', error);
    return NextResponse.json({ 
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
