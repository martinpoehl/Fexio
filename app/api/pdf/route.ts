import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { InvoicePDF } from '@/lib/InvoicePDF'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return new NextResponse('Missing documentId', { status: 400 })
    }

    const supabase = createClient()

    // ── Fetch document ──────────────────────────────────────────────────────
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select(
        'id, number, date, due_date, service_period, reference, status, notes, contact_name, subtotal, tax_amount, total, type, company_id, contact_id'
      )
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return new NextResponse('Document not found', { status: 404 })
    }

    // ── Fetch document lines ────────────────────────────────────────────────
    const { data: lines, error: linesError } = await supabase
      .from('document_lines')
      .select('position, description, quantity, unit, unit_price, discount, tax_rate, total')
      .eq('document_id', documentId)
      .order('position')

    if (linesError) {
      console.error('Error fetching lines:', linesError)
      return new NextResponse('Error fetching document lines', { status: 500 })
    }

    // ── Fetch company info ──────────────────────────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, address, zip, city, email, phone, iban, uid_nr, logo_url')
      .eq('id', doc.company_id)
      .single()

    if (companyError || !company) {
      console.error('Error fetching company:', companyError)
      return new NextResponse('Company not found', { status: 500 })
    }

    // ── Fetch contact info ──────────────────────────────────────────────────
    let contact = null
    if (doc.contact_id) {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('first_name, last_name, firm, address, zip, city, email, customer_number')
        .eq('id', doc.contact_id)
        .single()
      if (contactError) {
        // Fallback if customer_number column doesn't exist yet
        const { data: fallbackData } = await supabase
          .from('contacts')
          .select('first_name, last_name, firm, address, zip, city, email')
          .eq('id', doc.contact_id)
          .single()
        contact = fallbackData || null
      } else {
        contact = contactData || null
      }
    }

    // ── Fetch logo as base64 (optional) ────────────────────────────────────
    let logoBase64: string | null = null
    if (company.logo_url) {
      try {
        const logoRes = await fetch(company.logo_url)
        if (logoRes.ok) {
          const logoBuffer = await logoRes.arrayBuffer()
          const contentType = logoRes.headers.get('content-type') || 'image/png'
          logoBase64 = `data:${contentType};base64,${Buffer.from(logoBuffer).toString('base64')}`
        }
      } catch (logoErr) {
        console.warn('Could not fetch logo, skipping:', logoErr)
      }
    }

    // ── Render PDF ──────────────────────────────────────────────────────────
    const pdfElement = React.createElement(InvoicePDF, {
      document: doc,
      lines: lines || [],
      company,
      contact,
      logoBase64,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(pdfElement as any)

    // ── Sanitise filename ───────────────────────────────────────────────────
    const safeNumber = (doc.number || documentId).replace(/[^a-zA-Z0-9\-_]/g, '-')
    const filename = `${safeNumber}.pdf`

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
