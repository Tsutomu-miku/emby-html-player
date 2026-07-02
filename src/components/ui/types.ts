export interface LibraryFilterState {
  sortBy: string
  sortOrder: 'Ascending' | 'Descending'
  genre: string
  yearFrom: string
  yearTo: string
  played: 'all' | 'played' | 'unplayed'
  searchTerm: string
}

export const DEFAULT_FILTER: LibraryFilterState = {
  sortBy: 'SortName',
  sortOrder: 'Ascending',
  genre: '',
  yearFrom: '',
  yearTo: '',
  played: 'all',
  searchTerm: '',
}
