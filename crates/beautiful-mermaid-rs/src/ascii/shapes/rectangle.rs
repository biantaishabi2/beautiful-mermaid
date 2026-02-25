use crate::{Direction, DrawingCoord, ShapeDimensions};

pub fn get_box_attachment_point(
    dir: Direction,
    dimensions: &ShapeDimensions,
    base_coord: DrawingCoord,
) -> DrawingCoord {
    let width = dimensions.width as isize;
    let height = dimensions.height as isize;

    let center_x = base_coord.x + (width / 2);
    let center_y = base_coord.y + (height / 2);

    match dir {
        Direction::Up => DrawingCoord {
            x: center_x,
            y: base_coord.y,
        },
        Direction::Down => DrawingCoord {
            x: center_x,
            y: base_coord.y + height - 1,
        },
        Direction::Left => DrawingCoord {
            x: base_coord.x,
            y: center_y,
        },
        Direction::Right => DrawingCoord {
            x: base_coord.x + width - 1,
            y: center_y,
        },
        Direction::UpperLeft => DrawingCoord {
            x: base_coord.x,
            y: base_coord.y,
        },
        Direction::UpperRight => DrawingCoord {
            x: base_coord.x + width - 1,
            y: base_coord.y,
        },
        Direction::LowerLeft => DrawingCoord {
            x: base_coord.x,
            y: base_coord.y + height - 1,
        },
        Direction::LowerRight => DrawingCoord {
            x: base_coord.x + width - 1,
            y: base_coord.y + height - 1,
        },
        Direction::Middle => DrawingCoord {
            x: center_x,
            y: center_y,
        },
    }
}
