import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Upload } from 'lucide-react';
import { PageHeader } from '~components/shell';
import { Button } from '~components/button';
import { SearchInput } from '~components/field';
import { MiniCv, NewPaperCard, PaperCard, SectionHead } from '~components/paper';
import { AppFrame } from '~app/app-frame';
import { papers } from '~app/data';

/** Paper library: CVs, cover letters and files as thumbnails. */
export default function PaperLibrary() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const list = papers.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <AppFrame>
      <PageHeader title="Paper">
        <SearchInput value={q} onChange={setQ} placeholder="Search Paper" className="h-8 w-60" />
        <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => nav('/paper/jm-cv')}>New</Button>
      </PageHeader>
      <div className="flex flex-col gap-3 overflow-y-auto px-7 py-6">
        <SectionHead title="CVs" count={list.length} />
        <div className="flex flex-wrap gap-6">
          {list.map((p) => <PaperCard key={p.id} title={p.title} meta={p.meta} thumb={<MiniCv />} onClick={() => nav(`/paper/${p.id}`)} />)}
          <NewPaperCard label="New CV" onClick={() => nav('/paper/jm-cv')} />
        </div>
        <SectionHead title="Cover letters" count={0} />
        <p className="pl-5 text-fg-3">Coach writes one for each job you save.</p>
        <SectionHead title="Files" />
        <div className="pl-5"><Button variant="secondary" size="sm" icon={<Upload className="size-3.5" />}>Import a file</Button></div>
      </div>
    </AppFrame>
  );
}
