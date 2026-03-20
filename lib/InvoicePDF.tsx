import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentLine {
  position: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  discount: number
  tax_rate: number
  total: number
}

interface InvoicePDFProps {
  document: {
    number: string
    date: string
    due_date?: string
    service_period?: string
    reference?: string
    status: string
    notes?: string
    contact_name?: string
    subtotal: number
    tax_amount: number
    total: number
    type: string
  }
  lines: DocumentLine[]
  company: {
    name: string
    address?: string
    zip?: string
    city?: string
    email?: string
    phone?: string
    iban?: string
    uid_nr?: string
    logo_url?: string
  }
  contact?: {
    first_name?: string
    last_name?: string
    firm?: string
    address?: string
    zip?: string
    city?: string
    email?: string
    customer_number?: string
    uid_nr?: string
  } | null
  logoBase64?: string | null
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = '#1B2A4A'
const GREEN = '#00875A'
const LIGHT_GRAY = '#F5F6F8'
const MID_GRAY = '#E5E7EB'
const TEXT_DARK = '#111827'
const TEXT_MID = '#4B5563'
const TEXT_LIGHT = '#9CA3AF'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: TEXT_DARK,
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },

  // ── Header band ──
  headerBand: {
    backgroundColor: NAVY,
    paddingHorizontal: 40,
    paddingVertical: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerBandLogo: {
    backgroundColor: NAVY,
  },
  logoWrapper: {
    width: 57,
    height: 57,
    marginRight: 16,
    justifyContent: 'center',
  },
  logoFull: {
    width: 57,
    height: 57,
    objectFit: 'contain',
  },
  logo: {
    maxWidth: 80,
    maxHeight: 50,
    objectFit: 'contain',
  },
  companyInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  companyName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 8,
    color: '#CBD5E1',
    marginBottom: 2,
  },

  // ── Content area ──
  content: {
    paddingHorizontal: 40,
    paddingTop: 28,
  },

  // ── Document title ──
  docTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 20,
    letterSpacing: 1,
  },

  // ── Address block + meta ──
  addressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  addressBlock: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  addressLine: {
    fontSize: 9,
    color: TEXT_DARK,
    marginBottom: 2,
  },
  metaBlock: {
    width: 190,
    alignItems: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 8,
    color: TEXT_MID,
    width: 90,
  },
  metaValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_DARK,
    flex: 1,
  },

  // ── Divider ──
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: MID_GRAY,
    marginBottom: 16,
  },

  // ── Table ──
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 3,
    marginBottom: 1,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: LIGHT_GRAY,
  },
  tableRowOdd: {
    backgroundColor: '#FFFFFF',
  },
  tableCell: {
    fontSize: 8.5,
    color: TEXT_DARK,
  },

  // Column widths
  colPos: { width: 28 },
  colDesc: { flex: 1 },
  colQty: { width: 45, textAlign: 'right' },
  colUnit: { width: 42, textAlign: 'right' },
  colPrice: { width: 60, textAlign: 'right' },
  colDiscount: { width: 40, textAlign: 'right' },
  colTax: { width: 35, textAlign: 'right' },
  colTotal: { width: 65, textAlign: 'right' },

  // ── Totals ──
  totalsSection: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  totalsBox: {
    width: 220,
    borderTopWidth: 1,
    borderTopColor: MID_GRAY,
    paddingTop: 8,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalsLabel: {
    fontSize: 8.5,
    color: TEXT_MID,
  },
  totalsValue: {
    fontSize: 8.5,
    color: TEXT_DARK,
  },
  totalsFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: GREEN,
    paddingTop: 6,
    marginTop: 4,
  },
  totalsFinalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  totalsFinalValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: GREEN,
  },

  // ── Footer / payment info ──
  paymentSection: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: MID_GRAY,
  },
  paymentLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  paymentValue: {
    fontSize: 9,
    color: TEXT_DARK,
    marginBottom: 2,
  },
  notes: {
    marginTop: 14,
    fontSize: 8.5,
    color: TEXT_MID,
    lineHeight: 1.5,
  },

  // ── Page number ──
  pageNumber: {
    position: 'absolute',
    bottom: 16,
    right: 40,
    fontSize: 7,
    color: TEXT_LIGHT,
  },

  // ── Rapport sections ──
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionHeader: {
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 1,
    flexDirection: 'row',
  },
  sectionTable: {
    marginBottom: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  sectionRowEven: { backgroundColor: LIGHT_GRAY },
  sectionRowOdd:  { backgroundColor: '#FFFFFF' },
  sectionCell: {
    fontSize: 8,
    color: TEXT_DARK,
  },
  sectionSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: MID_GRAY,
    marginTop: 1,
  },
  sectionSubtotalLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginRight: 8,
  },
  sectionSubtotalValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    width: 70,
    textAlign: 'right',
  },

  // Rapport column widths – Ausgeführte Arbeiten
  rColDatum:       { width: 58 },
  rColZeit:        { width: 40, textAlign: 'right' },
  rColArbeiter:    { width: 65 },
  rColStundensatz: { width: 62, textAlign: 'right' },
  rColTaetigkeit:  { flex: 1 },
  rColKosten:      { width: 65, textAlign: 'right' },

  // Rapport column widths – Material
  mColBeschrieb:  { flex: 1 },
  mColMenge:      { width: 40, textAlign: 'right' },
  mColEinheit:    { width: 44 },
  mColStueckpreis:{ width: 65, textAlign: 'right' },
  mColKosten:     { width: 65, textAlign: 'right' },

  // Rapport column widths – Spesen
  sColKilometer: { width: 58, textAlign: 'right' },
  sColAnsatz:    { width: 58, textAlign: 'right' },
  sColBeschrieb: { flex: 1 },
  sColKosten:    { width: 65, textAlign: 'right' },

  // ── Rapport footer ──
  rapportFooter: {
    flexDirection: 'row',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: MID_GRAY,
    paddingTop: 12,
    gap: 20,
  },
  rapportBemerkung: {
    flex: 1,
  },
  rapportBemerkungLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 40,
  },
  rapportTotals: {
    width: 180,
  },
  rapportTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  rapportTotalLabel: {
    fontSize: 8.5,
    color: TEXT_MID,
  },
  rapportTotalValue: {
    fontSize: 8.5,
    color: TEXT_DARK,
  },
  rapportGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: GREEN,
    paddingTop: 5,
    marginTop: 4,
  },
  rapportGrandLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  rapportGrandValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: GREEN,
  },

  // ── Signatures ──
  signatureArea: {
    flexDirection: 'row',
    marginTop: 28,
    gap: 20,
  },
  signatureBox: {
    flex: 1,
  },
  signatureLabel: {
    fontSize: 8,
    color: TEXT_MID,
    marginBottom: 28,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: TEXT_DARK,
    marginBottom: 4,
  },
  signatureSubLabel: {
    fontSize: 7,
    color: TEXT_LIGHT,
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fNum(n: number): string {
  // Swiss apostrophe thousands separator, 2 decimal places
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fCHF(n: number): string {
  return `CHF ${fNum(n)}`
}

function fDate(d?: string): string {
  if (!d) return '–'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function docTypeLabel(type: string): string {
  if (type === 'offer') return 'OFFERTE'
  if (type === 'order') return 'AUFTRAG'
  return 'RECHNUNG'
}

function buildContactLines(
  contact: InvoicePDFProps['contact'],
  fallbackName?: string
): string[] {
  if (!contact) return fallbackName ? [fallbackName] : []
  const lines: string[] = []
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ')
  if (contact.firm) lines.push(contact.firm)
  if (fullName) lines.push(fullName)
  if (contact.address) lines.push(contact.address)
  if (contact.zip || contact.city)
    lines.push([contact.zip, contact.city].filter(Boolean).join(' '))
  if (contact.email) lines.push(contact.email)
  return lines
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoicePDF({
  document: doc,
  lines,
  company,
  contact,
  logoBase64,
}: InvoicePDFProps) {
  const isRapport = doc.type === 'order'
  const docTitle = isRapport ? 'Arbeitsrapport' : 'Rechnung'
  const contactLines = buildContactLines(contact, doc.contact_name)

  const companyAddress = [company.address, [company.zip, company.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')

  const logoSrc = logoBase64 || company.logo_url || null

  const hasDiscount = lines.some(l => l.discount && l.discount > 0)

  // Rapport: categorise lines by unit
  const arbeitenLines = lines.filter(l => ['h', 'Std', 'Std.'].includes(l.unit))
  const spesenLines   = lines.filter(l => l.unit === 'km')
  const materialLines = lines.filter(l => !['h', 'Std', 'Std.', 'km'].includes(l.unit))

  const sumLines = (ls: DocumentLine[]) => ls.reduce((s, l) => s + l.total, 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header band ── */}
        <View style={styles.headerBand}>
          {logoSrc && (
            <View style={styles.logoWrapper}>
              <Image src={logoSrc} style={styles.logoFull} />
            </View>
          )}
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{company.name}</Text>
            {companyAddress ? (
              <Text style={styles.companyDetail}>{companyAddress}</Text>
            ) : null}
            {company.email ? (
              <Text style={styles.companyDetail}>{company.email}</Text>
            ) : null}
            {company.phone ? (
              <Text style={styles.companyDetail}>{company.phone}</Text>
            ) : null}
            {company.uid_nr ? (
              <Text style={styles.companyDetail}>UID: {company.uid_nr}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Main content ── */}
        <View style={styles.content}>
          {/* Address + meta row */}
          <View style={styles.addressMetaRow}>
            {/* Recipient */}
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>An</Text>
              {contactLines.map((line, i) => (
                <Text key={i} style={styles.addressLine}>
                  {line}
                </Text>
              ))}
            </View>

            {/* Meta */}
            <View style={styles.metaBlock}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{docTitle}nummer:</Text>
                <Text style={styles.metaValue}>{doc.number}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{docTitle}datum:</Text>
                <Text style={styles.metaValue}>{fDate(doc.date)}</Text>
              </View>
              {!isRapport && doc.due_date && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Fällig bis:</Text>
                  <Text style={styles.metaValue}>{fDate(doc.due_date)}</Text>
                </View>
              )}
              {contact?.customer_number && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Kundennummer:</Text>
                  <Text style={styles.metaValue}>{contact.customer_number}</Text>
                </View>
              )}
              {contact?.uid_nr && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>UID-Nr.:</Text>
                  <Text style={styles.metaValue}>{contact.uid_nr}</Text>
                </View>
              )}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Ihr Ansprechpartner:</Text>
                <Text style={styles.metaValue}>Stefan Pöhl</Text>
              </View>
              {doc.service_period && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Leistungszeitraum:</Text>
                  <Text style={styles.metaValue}>{doc.service_period}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* ── Title ── */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 14 }}>{docTitle}</Text>
          </View>

          {isRapport ? (
            <>
              {/* ══ RAPPORT LAYOUT ══ */}

              {/* ── Ausgeführte Arbeiten ── */}
              <View style={styles.sectionTable}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, styles.rColDatum]}>Datum</Text>
                  <Text style={[styles.sectionTitle, styles.rColZeit]}>Zeit h</Text>
                  <Text style={[styles.sectionTitle, styles.rColArbeiter]}>Arbeiter</Text>
                  <Text style={[styles.sectionTitle, styles.rColStundensatz]}>Stundensatz</Text>
                  <Text style={[styles.sectionTitle, styles.rColTaetigkeit]}>Tätigkeit</Text>
                  <Text style={[styles.sectionTitle, styles.rColKosten]}>Kosten</Text>
                </View>
                {arbeitenLines.map((l, i) => (
                  <View key={i} style={[styles.sectionRow, i % 2 === 0 ? styles.sectionRowEven : styles.sectionRowOdd]}>
                    <Text style={[styles.sectionCell, styles.rColDatum]}></Text>
                    <Text style={[styles.sectionCell, styles.rColZeit]}>{fNum(l.quantity)}</Text>
                    <Text style={[styles.sectionCell, styles.rColArbeiter]}></Text>
                    <Text style={[styles.sectionCell, styles.rColStundensatz]}>{fNum(l.unit_price)}</Text>
                    <Text style={[styles.sectionCell, styles.rColTaetigkeit]}>{l.description}</Text>
                    <Text style={[styles.sectionCell, styles.rColKosten]}>{fNum(l.total)}</Text>
                  </View>
                ))}
                {arbeitenLines.length === 0 && (
                  <View style={[styles.sectionRow, styles.sectionRowEven]}>
                    <Text style={[styles.sectionCell, { color: TEXT_LIGHT }]}>–</Text>
                  </View>
                )}
                <View style={styles.sectionSubtotalRow}>
                  <Text style={styles.sectionSubtotalLabel}>Total Arbeiten</Text>
                  <Text style={styles.sectionSubtotalValue}>{fCHF(sumLines(arbeitenLines))}</Text>
                </View>
              </View>

              {/* ── Material ── */}
              <View style={styles.sectionTable}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, styles.mColBeschrieb]}>Beschrieb</Text>
                  <Text style={[styles.sectionTitle, styles.mColMenge]}>Menge</Text>
                  <Text style={[styles.sectionTitle, styles.mColEinheit]}>Einheit</Text>
                  <Text style={[styles.sectionTitle, styles.mColStueckpreis]}>Stückzahl</Text>
                  <Text style={[styles.sectionTitle, styles.mColKosten]}>Kosten</Text>
                </View>
                {materialLines.map((l, i) => (
                  <View key={i} style={[styles.sectionRow, i % 2 === 0 ? styles.sectionRowEven : styles.sectionRowOdd]}>
                    <Text style={[styles.sectionCell, styles.mColBeschrieb]}>{l.description}</Text>
                    <Text style={[styles.sectionCell, styles.mColMenge]}>{fNum(l.quantity)}</Text>
                    <Text style={[styles.sectionCell, styles.mColEinheit]}>{l.unit}</Text>
                    <Text style={[styles.sectionCell, styles.mColStueckpreis]}>{fNum(l.unit_price)}</Text>
                    <Text style={[styles.sectionCell, styles.mColKosten]}>{fNum(l.total)}</Text>
                  </View>
                ))}
                {materialLines.length === 0 && (
                  <View style={[styles.sectionRow, styles.sectionRowEven]}>
                    <Text style={[styles.sectionCell, { color: TEXT_LIGHT }]}>–</Text>
                  </View>
                )}
                <View style={styles.sectionSubtotalRow}>
                  <Text style={styles.sectionSubtotalLabel}>Total Material</Text>
                  <Text style={styles.sectionSubtotalValue}>{fCHF(sumLines(materialLines))}</Text>
                </View>
              </View>

              {/* ── Spesenabrechnung ── */}
              <View style={styles.sectionTable}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, styles.sColKilometer]}>Kilometer</Text>
                  <Text style={[styles.sectionTitle, styles.sColAnsatz]}>Ansatz</Text>
                  <Text style={[styles.sectionTitle, styles.sColBeschrieb]}>Beschrieb</Text>
                  <Text style={[styles.sectionTitle, styles.sColKosten]}>Kosten</Text>
                </View>
                {spesenLines.map((l, i) => (
                  <View key={i} style={[styles.sectionRow, i % 2 === 0 ? styles.sectionRowEven : styles.sectionRowOdd]}>
                    <Text style={[styles.sectionCell, styles.sColKilometer]}>{fNum(l.quantity)}</Text>
                    <Text style={[styles.sectionCell, styles.sColAnsatz]}>{fNum(l.unit_price)}</Text>
                    <Text style={[styles.sectionCell, styles.sColBeschrieb]}>{l.description}</Text>
                    <Text style={[styles.sectionCell, styles.sColKosten]}>{fNum(l.total)}</Text>
                  </View>
                ))}
                {spesenLines.length === 0 && (
                  <View style={[styles.sectionRow, styles.sectionRowEven]}>
                    <Text style={[styles.sectionCell, { color: TEXT_LIGHT }]}>–</Text>
                  </View>
                )}
                <View style={styles.sectionSubtotalRow}>
                  <Text style={styles.sectionSubtotalLabel}>Total Spesen</Text>
                  <Text style={styles.sectionSubtotalValue}>{fCHF(sumLines(spesenLines))}</Text>
                </View>
              </View>

              {/* ── Footer: Bemerkung + Totals ── */}
              <View style={styles.rapportFooter}>
                <View style={styles.rapportBemerkung}>
                  <Text style={styles.rapportBemerkungLabel}>Sonstiges / Bemerkung</Text>
                  {doc.notes ? (
                    <Text style={{ fontSize: 8.5, color: TEXT_DARK }}>{doc.notes}</Text>
                  ) : null}
                </View>
                <View style={styles.rapportTotals}>
                  <View style={styles.rapportTotalRow}>
                    <Text style={styles.rapportTotalLabel}>Rechnungsbetrag</Text>
                    <Text style={styles.rapportTotalValue}>{fCHF(doc.subtotal)}</Text>
                  </View>
                  <View style={styles.rapportTotalRow}>
                    <Text style={styles.rapportTotalLabel}>MwSt</Text>
                    <Text style={styles.rapportTotalValue}>{fCHF(doc.tax_amount)}</Text>
                  </View>
                  <View style={styles.rapportGrandRow}>
                    <Text style={styles.rapportGrandLabel}>Rechnungstotal</Text>
                    <Text style={styles.rapportGrandValue}>{fCHF(doc.total)}</Text>
                  </View>
                </View>
              </View>

              {/* ── Signatures ── */}
              <View style={styles.signatureArea}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Ort / Datum</Text>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureSubLabel}>Unterschrift Kunde</Text>
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Ort / Datum</Text>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureSubLabel}>Unterschrift Monteur</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* ══ RECHNUNG LAYOUT ══ */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 9, color: TEXT_DARK, marginBottom: 14 }}>Sehr geehrte Damen und Herren,</Text>
                <Text style={{ fontSize: 9, color: TEXT_DARK, marginBottom: 6 }}>Vielen Dank für Ihren Auftrag.</Text>
                <Text style={{ fontSize: 9, color: TEXT_DARK }}>
                  {`Wir stellen Ihnen folgende Leistungen${doc.reference ? ` gemäss Rapport Nr. ${doc.reference}` : ''} in Rechnung:`}
                </Text>
              </View>

              {/* Table */}
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colPos]}>Pos</Text>
                  <Text style={[styles.tableHeaderCell, styles.colDesc]}>Beschreibung</Text>
                  <Text style={[styles.tableHeaderCell, styles.colQty]}>Menge</Text>
                  <Text style={[styles.tableHeaderCell, styles.colUnit]}>Einheit</Text>
                  <Text style={[styles.tableHeaderCell, styles.colPrice]}>Preis</Text>
                  {hasDiscount && <Text style={[styles.tableHeaderCell, styles.colDiscount]}>Rabatt</Text>}
                  <Text style={[styles.tableHeaderCell, styles.colTax]}>MwSt</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
                </View>
                {lines.map((line, idx) => (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                    <Text style={[styles.tableCell, styles.colPos]}>{line.position}</Text>
                    <Text style={[styles.tableCell, styles.colDesc]}>{line.description}</Text>
                    <Text style={[styles.tableCell, styles.colQty]}>{fNum(line.quantity)}</Text>
                    <Text style={[styles.tableCell, styles.colUnit]}>{line.unit}</Text>
                    <Text style={[styles.tableCell, styles.colPrice]}>{fNum(line.unit_price)}</Text>
                    {hasDiscount && (
                      <Text style={[styles.tableCell, styles.colDiscount]}>
                        {line.discount && line.discount > 0 ? `${line.discount}%` : ''}
                      </Text>
                    )}
                    <Text style={[styles.tableCell, styles.colTax]}>{line.tax_rate}%</Text>
                    <Text style={[styles.tableCell, styles.colTotal]}>{fNum(line.total)}</Text>
                  </View>
                ))}
              </View>

              {/* Totals */}
              <View style={styles.totalsSection}>
                <View style={styles.totalsBox}>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Nettobetrag</Text>
                    <Text style={styles.totalsValue}>{fCHF(doc.subtotal)}</Text>
                  </View>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>MwSt</Text>
                    <Text style={styles.totalsValue}>{fCHF(doc.tax_amount)}</Text>
                  </View>
                  <View style={styles.totalsFinalRow}>
                    <Text style={styles.totalsFinalLabel}>Total</Text>
                    <Text style={styles.totalsFinalValue}>{fCHF(doc.total)}</Text>
                  </View>
                </View>
              </View>

              {/* Payment info */}
              {company.iban && (
                <View style={styles.paymentSection}>
                  <Text style={styles.paymentLabel}>Zahlbar an</Text>
                  <Text style={styles.paymentValue}>{company.name}</Text>
                  <Text style={styles.paymentValue}>IBAN: {company.iban}</Text>
                </View>
              )}

              {/* Notes */}
              {doc.notes && <Text style={styles.notes}>{doc.notes}</Text>}

              {/* Closing */}
              <View style={{ marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: MID_GRAY }}>
                <Text style={{ fontSize: 8.5, color: TEXT_MID, marginBottom: 10 }}>
                  Zahlungsbedingungen: Zahlung innerhalb von 30 Tagen ab Rechnungseingang.
                </Text>
                <Text style={{ fontSize: 8.5, color: TEXT_DARK }}>Mit freundlichen Grüssen</Text>
                <Text style={{ fontSize: 8.5, color: TEXT_DARK, marginTop: 4, fontFamily: 'Helvetica-Bold' }}>Stefan Pöhl</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Page number ── */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
