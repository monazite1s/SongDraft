'use client'

export function WorkLyricsTab({ lyrics }: { lyrics: string }) {
  const sections = lyrics.split('\n\n').map((section) => {
    const lines = section.trim().split('\n')
    const header = lines[0]
    const content = lines.slice(1).join('\n')
    return { header, content }
  })

  return (
    <div className="max-w-3xl">
      {sections.map((section, idx) => (
        <div key={idx} className="mb-6">
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
            {section.header}
          </h3>
          <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap font-light">
            {section.content}
          </p>
        </div>
      ))}
    </div>
  )
}
