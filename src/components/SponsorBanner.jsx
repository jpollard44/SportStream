/**
 * SponsorBanner — displays a sponsor slot below the page header.
 *
 * When no sponsor is set:
 *   - Visible only to the page host/admin (isHost=true)
 *   - Shows a muted "Your brand here" placeholder
 *
 * When a sponsor is set (sponsorName, sponsorLogoUrl, sponsorUrl on the doc):
 *   - Always shown to public visitors
 */
export default function SponsorBanner({ doc: pageDoc, isHost }) {
  const { sponsorName, sponsorLogoUrl, sponsorUrl } = pageDoc || {}

  if (sponsorName) {
    const inner = (
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <span className="text-[10px] font-semibold text-gray-500 shrink-0">Sponsored by</span>
        {sponsorLogoUrl && (
          <img src={sponsorLogoUrl} alt={sponsorName}
            className="h-6 w-auto max-w-[80px] object-contain opacity-80" />
        )}
        <span className="text-sm font-semibold text-gray-300 truncate">{sponsorName}</span>
      </div>
    )
    return (
      <div className="border-b border-white/5 bg-[#0f1117]">
        {sponsorUrl ? (
          <a href={sponsorUrl} target="_blank" rel="noopener noreferrer" className="block hover:bg-white/3 transition">
            {inner}
          </a>
        ) : inner}
      </div>
    )
  }

  if (!isHost) return null

  return (
    <div className="border-b border-white/5 bg-[#0f1117] px-4 py-2.5">
      <p className="text-[10px] text-gray-700 italic">
        Your brand here — contact <a href="mailto:sponsors@sportstream.app" className="text-gray-600 hover:text-gray-400 underline">sponsors@sportstream.app</a> to sponsor this page
      </p>
    </div>
  )
}
