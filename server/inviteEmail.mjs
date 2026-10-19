import nodemailer from 'nodemailer';
import QRCode from 'qrcode';

function renderEmailQrTable(qrCode) {
  const quietZone = 4;
  const moduleSize = 5;
  const fullSize = qrCode.modules.size + quietZone * 2;
  const rows = [];

  for (let y = 0; y < fullSize; y += 1) {
    const cells = [];
    let x = 0;
    while (x < fullSize) {
      const qrY = y - quietZone;
      const qrX = x - quietZone;
      const dark = qrY >= 0 && qrX >= 0 && qrY < qrCode.modules.size && qrX < qrCode.modules.size
        ? qrCode.modules.get(qrY, qrX)
        : false;
      let run = 1;
      while (x + run < fullSize) {
        const nextQrX = x + run - quietZone;
        const nextDark = qrY >= 0 && nextQrX >= 0 && qrY < qrCode.modules.size && nextQrX < qrCode.modules.size
          ? qrCode.modules.get(qrY, nextQrX)
          : false;
        if (nextDark !== dark) break;
        run += 1;
      }
      const color = dark ? '#111111' : '#ffffff';
      cells.push(`<td colspan="${run}" width="${run * moduleSize}" height="${moduleSize}" bgcolor="${color}" style="padding:0;border:0;font-size:0;line-height:0">&nbsp;</td>`);
      x += run;
    }
    rows.push(`<tr height="${moduleSize}">${cells.join('')}</tr>`);
  }

  const pixels = fullSize * moduleSize;
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="${pixels}" height="${pixels}" bgcolor="#ffffff" style="width:${pixels}px;height:${pixels}px;margin:0 auto;border-collapse:collapse;table-layout:fixed">${rows.join('')}</table>`;
}

function createTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) {
    throw new Error('Invite email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in the server environment.');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export async function sendInvitationEmail({ to, role, inviteLink, expiresAt }) {
  const transporter = createTransporter();
  const qr = await QRCode.toBuffer(inviteLink, {
    type: 'png',
    width: 240,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  const qrCode = QRCode.create(inviteLink, { errorCorrectionLevel: 'M' });
  const emailQrTable = renderEmailQrTable(qrCode);
  const displayRole = role === 'faculty' ? 'Faculty' : 'Alumni';
  const fromName = process.env.MAIL_FROM_NAME?.trim() || 'AUSTWise';
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Dhaka',
  });

  const result = await transporter.sendMail({
    from: { name: fromName, address: process.env.GMAIL_USER.trim() },
    to,
    subject: `Your AUSTWise ${displayRole} invitation`,
    text: `You have been invited to join AUSTWise as ${displayRole}. Open this link to set your password and create your account: ${inviteLink}\n\nA QR code is included in the attached PNG file. This invitation expires on ${expiryDate}.`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#f3f4f6;font-family:Arial,sans-serif;color:#172033">
        <div style="max-width:560px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:16px">
          <h1 style="margin:0 0 12px;font-size:24px;color:#172033">You’re invited to AUSTWise</h1>
          <p style="margin:0 0 20px;line-height:1.6;color:#4b5563">You’ve been invited to join as <strong>${displayRole}</strong>. Use the secure link below to set your password and create your account.</p>
          <p style="margin:0 0 24px"><a href="${inviteLink}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Accept invitation</a></p>
          <p style="margin:0 0 10px;color:#4b5563">Or scan this QR code to open the same invitation link:</p>
          <div style="margin:0 auto 20px;padding:8px;width:${qrCode.modules.size * 5 + 40}px;max-width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:10px">${emailQrTable}</div>
          <p style="margin:0 0 20px;font-size:12px;color:#6b7280">If the QR preview does not appear, download the attached <strong>austwise-invitation-qr.png</strong> and scan it.</p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280">If the button doesn’t work, copy this link into your browser:<br><a href="${inviteLink}" style="color:#2563eb;word-break:break-all">${inviteLink}</a></p>
          <p style="margin:16px 0 0;font-size:12px;color:#6b7280">This invitation expires on ${expiryDate}.</p>
        </div>
      </div>`,
    attachments: [{ filename: 'austwise-invitation-qr.png', content: qr, contentType: 'image/png', contentDisposition: 'attachment' }],
  });

  const accepted = result.accepted.some((address) => String(address).toLowerCase() === to.toLowerCase());
  if (!accepted) {
    const error = new Error('Gmail did not accept the invitation recipient.');
    error.code = 'EENVELOPE';
    throw error;
  }
  return { accepted, messageId: result.messageId, response: result.response };
}

export async function sendAlumniTransferEmail({ to, name, resetLink }) {
  const transporter = createTransporter();
  const fromName = process.env.MAIL_FROM_NAME?.trim() || 'AUSTWise';
  const result = await transporter.sendMail({
    from: { name: fromName, address: process.env.GMAIL_USER.trim() },
    to,
    subject: 'Welcome to the AUSTWise Alumni Network',
    text: `Hello ${name}, your AUSTWise student account has graduated and moved to this personal email. Set a new password here: ${resetLink}\n\nThis secure link expires in one hour.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;color:#172033"><h1>Welcome to the AUSTWise Alumni Network</h1><p>Hello ${String(name || 'Graduate').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))}, your student account has graduated and moved to this personal email.</p><p><a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Set your alumni password</a></p><p>This secure link expires in one hour.</p></div>`,
  });
  if (!result.accepted.some(address => String(address).toLowerCase() === to.toLowerCase())) throw new Error('Gmail did not accept the alumni recipient.');
  return { accepted: true, messageId: result.messageId };
}
