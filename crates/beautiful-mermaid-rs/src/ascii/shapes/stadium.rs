#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LabelArea {
    pub x: usize,
    pub y: usize,
    pub width: usize,
    pub height: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShapeDimensions {
    pub width: usize,
    pub height: usize,
    pub label_area: LabelArea,
    pub grid_columns: [usize; 3],
    pub grid_rows: [usize; 3],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ShapeRenderOptions {
    pub use_ascii: bool,
    pub padding: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DrawingCoord {
    pub x: isize,
    pub y: isize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
    UpperLeft,
    UpperRight,
    LowerLeft,
    LowerRight,
    Middle,
}

pub type Canvas = Vec<Vec<char>>;
mod rectangle;

pub fn get_dimensions(label: &str, options: ShapeRenderOptions) -> ShapeDimensions {
    let lines = split_lines(label);
    let max_line_width = lines.iter().map(|line| code_point_width(line)).max().unwrap_or(0);
    let line_count = lines.len();

    let inner_width = (2 * options.padding) + max_line_width;
    let width = inner_width + 4;
    let inner_height = line_count + (2 * options.padding);
    let height = (inner_height + 2).max(3);

    ShapeDimensions {
        width,
        height,
        label_area: LabelArea {
            x: 2 + options.padding,
            y: 1 + options.padding,
            width: max_line_width,
            height: line_count,
        },
        grid_columns: [2, inner_width, 2],
        grid_rows: [1, inner_height, 1],
    }
}

pub fn render(label: &str, dimensions: &ShapeDimensions, options: ShapeRenderOptions) -> Canvas {
    let width = dimensions.width;
    let height = dimensions.height;
    let inner_width = dimensions.grid_columns[1];
    let inner_height = dimensions.grid_rows[1];
    let mut canvas = mk_canvas(width - 1, height - 1);

    let center_y = height / 2;
    let h_char = if options.use_ascii { '-' } else { '─' };

    if height == 3 {
        canvas[0][center_y] = '(';
        canvas[width - 1][center_y] = ')';
    } else if !options.use_ascii {
        canvas[0][0] = '╭';
        for x in 1..(width - 1) {
            canvas[x][0] = h_char;
        }
        canvas[width - 1][0] = '╮';

        for y in 1..(height - 1) {
            canvas[0][y] = '│';
            canvas[width - 1][y] = '│';
        }

        canvas[0][height - 1] = '╰';
        for x in 1..(width - 1) {
            canvas[x][height - 1] = h_char;
        }
        canvas[width - 1][height - 1] = '╯';
    } else {
        for y in 0..height {
            canvas[0][y] = '(';
            canvas[width - 1][y] = ')';
        }
        for x in 1..(width - 1) {
            canvas[x][0] = h_char;
            canvas[x][height - 1] = h_char;
        }
    }

    let lines = split_lines(label);
    let start_y = 1 + ((inner_height - lines.len()) / 2);

    for (i, line) in lines.iter().enumerate() {
        let chars: Vec<char> = line.chars().collect();
        let text_width = chars.len();
        let text_x = 2 + ((inner_width - text_width) / 2);

        for (j, ch) in chars.iter().enumerate() {
            let x = text_x + j;
            let y = start_y + i;
            if x > 0 && x < (width - 1) && y < height {
                canvas[x][y] = *ch;
            }
        }
    }

    canvas
}

pub fn get_attachment_point(
    dir: Direction,
    dimensions: &ShapeDimensions,
    base_coord: DrawingCoord,
) -> DrawingCoord {
    rectangle::get_box_attachment_point(dir, dimensions, base_coord)
}

fn mk_canvas(max_x: usize, max_y: usize) -> Canvas {
    let mut canvas = Vec::with_capacity(max_x + 1);
    for _ in 0..=max_x {
        canvas.push(vec![' '; max_y + 1]);
    }
    canvas
}

fn split_lines(label: &str) -> Vec<&str> {
    label.split('\n').collect()
}

fn code_point_width(line: &str) -> usize {
    line.chars().count()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rows(canvas: &Canvas) -> Vec<String> {
        if canvas.is_empty() || canvas[0].is_empty() {
            return Vec::new();
        }
        let width = canvas.len();
        let height = canvas[0].len();
        (0..height)
            .map(|y| (0..width).map(|x| canvas[x][y]).collect::<String>())
            .collect()
    }

    #[test]
    fn ascii_single_line_dimensions_and_render() {
        let options = ShapeRenderOptions {
            use_ascii: true,
            padding: 0,
        };
        let dimensions = get_dimensions("A", options);
        assert_eq!(dimensions.width, 5);
        assert_eq!(dimensions.height, 3);
        assert_eq!(dimensions.grid_columns, [2, 1, 2]);
        assert_eq!(dimensions.grid_rows, [1, 1, 1]);

        let canvas = render("A", &dimensions, options);
        assert_eq!(rows(&canvas), vec!["     ", "( A )", "     "]);
    }

    #[test]
    fn unicode_single_line_uses_code_point_width() {
        let options = ShapeRenderOptions {
            use_ascii: false,
            padding: 0,
        };
        let dimensions = get_dimensions("测试", options);
        assert_eq!(dimensions.width, 6);
        assert_eq!(dimensions.height, 3);

        let canvas = render("测试", &dimensions, options);
        assert_eq!(rows(&canvas), vec!["      ", "( 测试 )", "      "]);
    }

    #[test]
    fn ascii_multi_line_vertical_distribution() {
        let options = ShapeRenderOptions {
            use_ascii: true,
            padding: 0,
        };
        let dimensions = get_dimensions("A\nB", options);
        assert_eq!(dimensions.width, 5);
        assert_eq!(dimensions.height, 4);
        assert_eq!(dimensions.grid_rows, [1, 2, 1]);

        let canvas = render("A\nB", &dimensions, options);
        assert_eq!(rows(&canvas), vec!["(---)", "( A )", "( B )", "(---)"]);
    }

    #[test]
    fn empty_label_renders_border_only() {
        let options = ShapeRenderOptions {
            use_ascii: true,
            padding: 0,
        };
        let dimensions = get_dimensions("", options);
        assert_eq!(dimensions.width, 4);
        assert_eq!(dimensions.height, 3);

        let canvas = render("", &dimensions, options);
        assert_eq!(rows(&canvas), vec!["    ", "(  )", "    "]);
    }

    #[test]
    fn odd_even_centering_follows_floor_rule() {
        let options = ShapeRenderOptions {
            use_ascii: true,
            padding: 0,
        };

        let dims_even = get_dimensions("AB", options);
        assert_eq!(dims_even.width, 6);
        let even_rows = rows(&render("AB", &dims_even, options));
        assert_eq!(even_rows[1], "( AB )");

        let dims_odd = get_dimensions("ABC", options);
        assert_eq!(dims_odd.width, 7);
        let odd_rows = rows(&render("ABC", &dims_odd, options));
        assert_eq!(odd_rows[1], "( ABC )");
    }

    #[test]
    fn non_bmp_emoji_counts_as_one_code_point() {
        let options = ShapeRenderOptions {
            use_ascii: true,
            padding: 0,
        };
        let dimensions = get_dimensions("😀", options);
        assert_eq!(dimensions.width, 5);

        let canvas = render("😀", &dimensions, options);
        assert_eq!(rows(&canvas)[1], "( 😀 )");
    }

    #[test]
    fn attachment_point_reuses_box_logic() {
        let options = ShapeRenderOptions {
            use_ascii: true,
            padding: 0,
        };
        let dimensions = get_dimensions("AB", options);
        let base = DrawingCoord { x: 10, y: 20 };

        assert_eq!(
            get_attachment_point(Direction::Up, &dimensions, base),
            DrawingCoord { x: 13, y: 20 }
        );
        assert_eq!(
            get_attachment_point(Direction::Right, &dimensions, base),
            DrawingCoord { x: 15, y: 21 }
        );
        assert_eq!(
            get_attachment_point(Direction::Middle, &dimensions, base),
            DrawingCoord { x: 13, y: 21 }
        );
    }
}
