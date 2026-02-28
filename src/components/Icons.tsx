import type { SVGProps } from 'react'

export function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12.1 20.3s-7.1-4.6-9.3-8.6C1.1 8.8 2.2 5.8 5 4.8c1.7-.6 3.6-.1 5 1.2 1.4-1.3 3.3-1.8 5-1.2 2.8 1 3.9 4 2.2 6.9-2.2 4-9.1 8.6-9.1 8.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function HeartFilledIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.1 20.3s-7.1-4.6-9.3-8.6C1.1 8.8 2.2 5.8 5 4.8c1.7-.6 3.6-.1 5 1.2 1.4-1.3 3.3-1.8 5-1.2 2.8 1 3.9 4 2.2 6.9-2.2 4-9.1 8.6-9.1 8.6Z" />
    </svg>
  )
}

export function ThumbUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9 11V21H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 11l4-7a2 2 0 0 1 3.7 1.3L15.5 11H20a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ThumbDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9 13V3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 13l4 7a2 2 0 0 0 3.7-1.3L15.5 13H20a2 2 0 0 0 2-2l-1-6a2 2 0 0 0-2-2H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

