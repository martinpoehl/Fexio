import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase-server'

// SMTP settings — set these in Vercel environment variables or .env.local:
// SMTP_HOST=mail.hostpoint.ch
// SMTP_PORT=587
// SMTP_USER=info@dokagimo.myhostpoint.ch
// SMTP_PASS=<dein E-Mail-Passwort>

export async function POST(req: NextRequest) {
  if (!process.env.SMTP_PASS) {
    return NextResponse.json(
      { error: 'E-Mail nicht konfiguriert. Bitte SMTP_PASS in Vercel setzen.' },
      { status: 500 }
    )
  }

  let body: { documentId: string; recipientEmail: string; subject: string; message: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const { documentId, recipientEmail, subject, message } = body

  if (!documentId || !recipientEmail || !subject) {
    return NextResponse.json({ error: 'Fehlende Pflichtfelder.' }, { status: 400 })
  }

  const supabase = createClient()

  // Fetch document with line items
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('*, contacts(name, first_name, last_name, firm, email)')
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 })
  }

  // Fetch line items
  const { data: lines } = await supabase
    .from('document_lines')
    .select('*')
    .eq('document_id', documentId)
    .order('position')

  // Fetch company info
  const { data: company } = await supabase
    .from('companies')
    .select('name, email, phone, address, city, zip, iban, logo_url')
    .eq('id', doc.company_id)
    .single()

  // Build contact display name
  const contact = doc.contacts
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
      contact.name ||
      contact.firm ||
      'Sehr geehrte Damen und Herren'
    : 'Sehr geehrte Damen und Herren'

  // Type labels
  const typeLabels: Record<string, string> = {
    invoice: 'Rechnung',
    offer: 'Offerte',
    order: 'Auftrag',
  }
  const docTypeLabel = typeLabels[doc.type] || 'Dokument'

  // Date formatter
  const fDate = (d: string) => {
    if (!d) return ''
    const dt = new Date(d)
    return (
      String(dt.getDate()).padStart(2, '0') +
      '.' +
      String(dt.getMonth() + 1).padStart(2, '0') +
      '.' +
      dt.getFullYear()
    )
  }

  // Currency formatter
  const fCHF = (n: number) =>
    new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n || 0)

  // Build line items HTML
  const lineItemsHtml = (lines || [])
    .map(
      (l: any) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151;">${l.position}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151;">${l.description || '–'}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151; text-align: right;">${l.quantity} ${l.unit || ''}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151; text-align: right;">${fCHF(l.unit_price)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151; text-align: right;">${l.tax_rate}%</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; font-weight: 600; color: #111827; text-align: right;">${fCHF(l.total)}</td>
        </tr>`
    )
    .join('')

  // Company address block
  const companyName = company?.name || 'Unbekannte Firma'
  const companyAddressParts = [
    company?.address,
    [company?.zip, company?.city].filter(Boolean).join(' '),
    company?.email,
    company?.phone,
  ].filter(Boolean)
  const companyAddressHtml = companyAddressParts
    .map(p => `<span>${p}</span>`)
    .join('<br/>')

  // User message (preserve line breaks)
  const messageHtml = (message || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background-color: #00875A; border-radius: 12px 12px 0 0; padding: 28px 32px; text-align: left;">
              ${
                company?.logo_url
                  ? `<img src="${company.logo_url}" alt="${companyName}" style="height: 40px; margin-bottom: 8px; display: block;" />`
                  : ''
              }
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${companyName}</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.8);">${docTypeLabel} ${doc.number}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 32px 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">

              <!-- Greeting -->
              <p style="margin: 0 0 20px; font-size: 15px; color: #111827;">
                Sehr geehrte/r ${contactName},
              </p>

              <!-- User message -->
              <p style="margin: 0 0 28px; font-size: 14px; color: #374151; line-height: 1.6;">
                ${messageHtml}
              </p>

              <!-- Document info box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8faf9; border: 1px solid #d1fae5; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Dokumentdetails</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
                      <tr>
                        <td style="font-size: 13px; color: #6b7280; padding: 3px 0; width: 140px;">${docTypeLabel}-Nummer</td>
                        <td style="font-size: 13px; font-weight: 600; color: #111827; padding: 3px 0;">${doc.number}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #6b7280; padding: 3px 0;">Datum</td>
                        <td style="font-size: 13px; color: #111827; padding: 3px 0;">${fDate(doc.date)}</td>
                      </tr>
                      ${
                        doc.due_date
                          ? `<tr>
                        <td style="font-size: 13px; color: #6b7280; padding: 3px 0;">Fällig am</td>
                        <td style="font-size: 13px; color: #111827; padding: 3px 0;">${fDate(doc.due_date)}</td>
                      </tr>`
                          : ''
                      }
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Line items table -->
              ${
                (lines || []).length > 0
                  ? `<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 20px; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">#</th>
                    <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Beschreibung</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Menge</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Preis</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">MwSt</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>`
                  : ''
              }

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td width="60%"></td>
                  <td width="40%">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Nettobetrag</td>
                        <td style="font-size: 13px; color: #374151; padding: 4px 0; text-align: right;">${fCHF(doc.subtotal)}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">MwSt</td>
                        <td style="font-size: 13px; color: #374151; padding: 4px 0; text-align: right;">${fCHF(doc.tax_amount)}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; font-weight: 700; color: #111827; padding: 8px 0 4px; border-top: 2px solid #111827;">Total</td>
                        <td style="font-size: 14px; font-weight: 700; color: #111827; padding: 8px 0 4px; border-top: 2px solid #111827; text-align: right;">${fCHF(doc.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${
                company?.iban
                  ? `<!-- Payment info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 6px; font-size: 11px; font-weight: 600; color: #1e40af; text-transform: uppercase; letter-spacing: 0.05em;">Zahlungsdetails</p>
                    <p style="margin: 0; font-size: 13px; color: #1e3a8a;">
                      <strong>IBAN:</strong> ${company.iban}<br/>
                      <strong>Empfänger:</strong> ${companyName}<br/>
                      <strong>Verwendungszweck:</strong> ${doc.number}
                    </p>
                  </td>
                </tr>
              </table>`
                  : ''
              }

              ${
                doc.notes
                  ? `<!-- Notes -->
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin-bottom: 28px;">
                <p style="margin: 0 0 6px; font-size: 11px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em;">Notizen</p>
                <p style="margin: 0; font-size: 13px; color: #78350f;">${doc.notes.replace(/\n/g, '<br/>')}</p>
              </div>`
                  : ''
              }

              <p style="margin: 0; font-size: 14px; color: #374151;">
                Bei Fragen stehen wir Ihnen gerne zur Verfügung.
              </p>
              <p style="margin: 8px 0 0; font-size: 14px; color: #374151;">
                Freundliche Grüsse<br/>
                <strong>${companyName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                ${companyAddressHtml || companyName}
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: #d1d5db;">
                Diese E-Mail wurde über Fexio versendet.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const smtpUser = process.env.SMTP_USER || 'info@dokagimo.myhostpoint.ch'
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.hostpoint.ch',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: smtpUser,
      pass: process.env.SMTP_PASS,
    },
  })

  try {
    await transporter.sendMail({
      from: `Fexio <${smtpUser}>`,
      to: recipientEmail,
      subject,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Send email error:', err)
    return NextResponse.json(
      { error: err?.message || 'E-Mail konnte nicht gesendet werden.' },
      { status: 500 }
    )
  }
}
