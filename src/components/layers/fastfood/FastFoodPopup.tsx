import { CarIcon, ClockIcon, MapPinIcon, PhoneIcon } from 'lucide-react';
import MapPopup from '../../map/MapPopup';
import { ICON_ACTION, PopupActions, popupActionClass, RouteAction } from '../../map/popup/PopupActions';
import PopupHeader, { PopupIcon } from '../../map/popup/PopupHeader';
import { PopupRow, PopupRows, type RowTone } from '../../map/popup/PopupRows';
import { FadeSwap } from '@/components/beheer/BeheerLayout';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { BRAND_COLOR, BRAND_LABEL, fastfoodStatus, restaurantAddress, type FastfoodState } from '@/lib/fastfood';
import { joinParts } from '@/lib/format';
import type { FastfoodRestaurant } from '@/types/Fastfood';
import { BRAND_LOGO_URL, FASTFOOD_LOGO_WIDTH } from '../brand-logos';

// Above the tile (28px square, centred)
const POPUP_OFFSET = { bottom: [0, -18] as [number, number] };

const TONE: Record<FastfoodState, RowTone> = { open: 'success', closing: 'warn', closed: 'danger', unknown: 'default' };

/** A restaurant: opening status (green / orange / red / unknown), address, drive-thru, Route and call. */
export default function FastFoodPopup({ restaurant, nowMs, onClose }: { restaurant: FastfoodRestaurant; nowMs: number; onClose: () => void }) {
  const [lng, lat] = restaurant.location.coordinates;
  const distance = useDistanceFromMe(lat, lng);
  const status = fastfoodStatus(restaurant.intervals, nowMs);
  const { line1, line2 } = restaurantAddress(restaurant);

  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={POPUP_OFFSET}>
      <PopupHeader
        icon={
          <PopupIcon shape="square" rim background={BRAND_COLOR[restaurant.brand]} color="#fff">
            <img src={BRAND_LOGO_URL[restaurant.brand]} alt="" width={FASTFOOD_LOGO_WIDTH[restaurant.brand] + 4} />
          </PopupIcon>
        }
        title={BRAND_LABEL[restaurant.brand]}
        subtitle={joinParts(restaurant.branch, distance)}
      />
      <PopupRows>
        {/* FadeSwap is a block motion.div inside the row's truncating wrapper, so it truncates itself */}
        <PopupRow
          icon={<ClockIcon />}
          tone={TONE[status.state]}
          title={<FadeSwap className="truncate">{status.title}</FadeSwap>}
          meta={<FadeSwap className="truncate">{status.meta}</FadeSwap>}
        />
        {(line1 || line2) && <PopupRow icon={<MapPinIcon />} title={line1 ?? line2} meta={line1 ? line2 : undefined} />}
        {restaurant.driveThrough !== undefined && <PopupRow icon={<CarIcon />} title={restaurant.driveThrough ? 'Drive-thru' : 'Geen drive-thru'} />}
      </PopupRows>
      <PopupActions>
        <RouteAction lat={lat} lng={lng} />
        {restaurant.phone && (
          <a href={`tel:${restaurant.phone.replace(/\s+/g, '')}`} aria-label={`Bel ${BRAND_LABEL[restaurant.brand]}`} title="Bellen" className={popupActionClass('neutral', ICON_ACTION)}>
            <PhoneIcon />
          </a>
        )}
      </PopupActions>
    </MapPopup>
  );
}
