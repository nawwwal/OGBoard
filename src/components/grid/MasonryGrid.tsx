interface Props {
  children: React.ReactNode
  columns?: 2 | 3 | 4
}

export default function MasonryGrid({ children, columns = 3 }: Props) {
  const colClass = {
    2: 'columns-1 sm:columns-2',
    3: 'columns-1 sm:columns-2 lg:columns-3',
    4: 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4',
  }[columns]

  return (
    <div className={`${colClass} gap-4 [column-fill:_balance]`}>
      {children}
    </div>
  )
}
