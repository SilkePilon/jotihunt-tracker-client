import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import useHintBoardStore from '@/stores/hint-board.store';

/**
 * Old /hints links (bookmarks, /hints?article=<id>&area=<area>) now open the hint board dialog on the map.
 */
export default function Hints() {
  const [searchParams] = useSearchParams();
  const openBoard = useHintBoardStore((state) => state.openBoard);
  const openCell = useHintBoardStore((state) => state.openCell);
  const articleId = Number(searchParams.get('article'));
  const area = searchParams.get('area');

  useEffect(() => {
    if (articleId && area) openCell({ articleId, area });
    else openBoard();
  }, [openBoard, openCell, articleId, area]);

  return <Navigate to="/" replace />;
}
