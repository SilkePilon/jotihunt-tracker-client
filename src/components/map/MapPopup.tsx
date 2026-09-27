import {Popup, type PopupProps} from 'react-map-gl/maplibre';
import PropTypes from 'prop-types';
import {ReactNode} from "react";
import type {PositionAnchor} from "maplibre-gl";

type OffsetObject = Partial<Record<PositionAnchor, [number, number]>>;

type MapPopupProps = {
    longitude: number;
    latitude: number;
    onClose: () => void;
    children: ReactNode;
    // MapLibre's Offset type requires every anchor key to be present; we
    // only ever set one (e.g. `bottom`), so accept a partial map here and
    // cast when handing it to <Popup>. Partial offsets work fine at runtime.
    offset?: number | [number, number] | OffsetObject;
};

const defaultOffset: OffsetObject = {bottom: [0, -45]};

export default function MapPopup({longitude, latitude, onClose, offset = defaultOffset, children}: MapPopupProps) {
    return (
        <Popup anchor="bottom" longitude={longitude} latitude={latitude} onClose={onClose} closeOnClick={true}
               offset={offset as PopupProps['offset']} maxWidth="400px" className="z-20">
            <div>{children}</div>
        </Popup>
    );
}

MapPopup.propTypes = {
    longitude: PropTypes.number.isRequired,
    latitude: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    offset: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.array,
        PropTypes.object,
        PropTypes.func,
    ]),
    children: PropTypes.node.isRequired,
};
