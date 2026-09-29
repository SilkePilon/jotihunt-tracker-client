import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useHintBoard } from '@/hooks/hints.hook';
import { capitalizeFirstLetter } from '@/lib/utils';
import useHintBoardStore from '@/stores/hint-board.store';
import { User } from '@/types/User';
import HintDetail from './HintDetail';

/**
 * Detail of one hint cell (hint × fox team) in its own dialog: a dialog on desktop, a bottom drawer on phones.
 */
export default function HintDetailDialog({ onShowOnMap }: { onShowOnMap: (lng: number, lat: number) => void }) {
  const user = useAuthUser<User>();
  const actions = useHintBoard();
  const { board } = actions;
  const open = useHintBoardStore((state) => state.view === 'detail');
  const selected = useHintBoardStore((state) => state.selected);
  const close = useHintBoardStore((state) => state.close);
  const backToOverview = useHintBoardStore((state) => state.backToOverview);

  const article = board?.articles.find((item) => item.id === selected?.articleId);
  const cell = board?.cells.find((item) => item.articleId === selected?.articleId && item.area === selected?.area);

  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      title={selected ? `Hint ${capitalizeFirstLetter(selected.area)}` : 'Hint'}
      description="Claim, los op en controleer deze hint."
      className="h-auto max-h-[88dvh] gap-0 sm:max-w-xl"
      hideHeader
    >
      <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 md:-mx-6 md:px-6">
        {article && cell ? (
          <HintDetail
            key={cell._id}
            article={article}
            cell={cell}
            currentUserId={user?._id}
            isAdmin={user?.admin}
            actions={actions}
            onBack={backToOverview}
            onShowOnMap={onShowOnMap}
          />
        ) : (
          <p className="p-4 text-muted-foreground">{board ? 'Deze hint bestaat niet (meer).' : 'Laden...'}</p>
        )}
      </div>
    </ResponsiveDialog>
  );
}
