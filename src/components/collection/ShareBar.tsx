import { useState } from 'react'

interface Props {
  collectionId: string
  collectionName: string
  isOwner: boolean
  itemCount: number
}

export default function ShareBar({
  collectionId,
  collectionName,
  isOwner,
  itemCount,
}: Props) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    const url = `${window.location.origin}/c/${collectionId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="flex items-center gap-3 px-5 py-3"
      style={{ borderBottom: '1px solid oklch(86% 0.012 70)' }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="font-semibold truncate"
          style={{ fontSize: '13px', color: 'oklch(22% 0.020 58)', fontFamily: 'var(--font-sans)' }}
        >
          {collectionName}
        </p>
        <p
          className="font-semibold tracking-[0.10em] uppercase"
          style={{ fontSize: '9px', color: 'oklch(56% 0.016 68)', fontFamily: 'var(--font-sans)' }}
        >
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
          {!isOwner && ' · read-only'}
        </p>
      </div>

      <button
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded font-semibold tracking-[0.12em] uppercase"
        style={{
          fontSize: '10px',
          padding: '5px 12px',
          border: '1px solid',
          borderColor: copied ? 'oklch(62% 0.13 155)' : 'oklch(82% 0.016 68)',
          color: copied ? 'oklch(36% 0.12 155)' : 'oklch(40% 0.016 65)',
          backgroundColor: copied ? 'oklch(93% 0.05 155)' : 'oklch(99% 0.008 70)',
          fontFamily: 'var(--font-sans)',
          transition: 'all 140ms ease',
          cursor: 'pointer',
        }}
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
