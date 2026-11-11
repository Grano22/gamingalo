'use client';

import { useStaticSearch } from 'fumadocs-core/search/client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';

/** Search runs in the browser, from an index exported at build time, because the site is static. */
export default function StaticSearchDialog(props: SharedProps) {
  const search = useStaticSearch({ from: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/search` });
  return (
    <SearchDialog {...props} {...search}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput aria-label="Search the docs" />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  );
}
