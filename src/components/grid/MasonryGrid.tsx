interface Props {
  children: React.ReactNode
  columns?: 2 | 3 | 4
}

export default function MasonryGrid({ children, columns = 3 }: Props) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns]

  return (
    <div
      className={`grid ${colClass} gap-4 items-start`}
      style={{ gridTemplateRows: 'masonry' }}
    >
      {children}
    </div>
  )
}
