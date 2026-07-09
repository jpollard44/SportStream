// Minimal CSV parser for lead imports. Handles quoted fields, commas and
// newlines inside quotes, and CRLF. Maps common header aliases onto the
// canonical lead fields.

export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const src = (text || '').replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

const HEADER_ALIASES = {
  email: ['email', 'email address', 'e-mail', 'work email'],
  firstName: ['first name', 'firstname', 'first', 'given name'],
  lastName: ['last name', 'lastname', 'last', 'surname', 'family name'],
  company: ['company', 'company name', 'organization', 'organisation', 'account'],
  title: ['title', 'job title', 'position', 'role'],
  website: ['website', 'url', 'domain', 'company website'],
  phone: ['phone', 'phone number', 'mobile'],
  linkedin: ['linkedin', 'linkedin url', 'li url'],
  city: ['city', 'location'],
}

function canonicalField(header) {
  const h = header.trim().toLowerCase()
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return field
  }
  // Unknown columns become custom merge tags: "Custom Var" -> customVar
  return header.trim().replace(/[^\w ]/g, '').split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('') || null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Returns { leads, skipped } — skipped counts rows without a valid email.
export function parseLeadsCsv(text) {
  const rows = parseCsv(text)
  if (rows.length === 0) return { leads: [], skipped: 0 }
  const fields = rows[0].map(canonicalField)
  const leads = []
  let skipped = 0
  const seen = new Set()
  for (const row of rows.slice(1)) {
    const lead = {}
    row.forEach((cell, i) => {
      if (fields[i] && cell.trim() !== '') lead[fields[i]] = cell.trim()
    })
    const email = (lead.email || '').toLowerCase()
    if (!EMAIL_RE.test(email) || seen.has(email)) { skipped++; continue }
    seen.add(email)
    lead.email = email
    leads.push(lead)
  }
  return { leads, skipped }
}
