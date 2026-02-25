const LINE_HEIGHT_RATIO: f64 = 1.3;
const DEFAULT_BASELINE_SHIFT: f64 = 0.35;

const STRIP_TAGS: [&str; 4] = ["sub", "sup", "small", "mark"];
const FORMATTING_TAGS: [&str; 7] = ["b", "strong", "i", "em", "u", "s", "del"];

#[derive(Clone, Copy, Default)]
struct StyleState {
    bold: bool,
    italic: bool,
    underline: bool,
    strikethrough: bool,
}

#[derive(Clone)]
struct StyledSegment {
    text: String,
    style: StyleState,
}

#[derive(Clone, Copy)]
enum FormatTag {
    Bold,
    Italic,
    Underline,
    Strikethrough,
}

pub fn normalize_br_tags(label: &str) -> String {
    let unquoted = strip_surrounding_quotes(label);
    let with_breaks = replace_br_tags(unquoted).replace("\\n", "\n");
    let stripped = remove_simple_tags(&with_breaks, &STRIP_TAGS);
    let with_bold = replace_markdown_pair(&stripped, "**", "<b>", "</b>");
    let with_italic = replace_markdown_italic(&with_bold);
    replace_markdown_pair(&with_italic, "~~", "<s>", "</s>")
}

pub fn strip_formatting_tags(text: &str) -> String {
    remove_simple_tags(text, &FORMATTING_TAGS)
}

pub fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

pub fn render_multiline_text(
    text: &str,
    cx: f64,
    cy: f64,
    font_size: f64,
    attrs: &str,
    baseline_shift: f64,
) -> String {
    let lines: Vec<&str> = text.split('\n').collect();
    if lines.len() == 1 {
        let dy = font_size * baseline_shift;
        return format!(
            "<text x=\"{}\" y=\"{}\" {} dy=\"{}\">{}</text>",
            cx,
            cy,
            attrs,
            dy,
            render_line_content(text)
        );
    }

    let line_height = font_size * LINE_HEIGHT_RATIO;
    let first_dy = -((lines.len() as f64 - 1.0) / 2.0) * line_height + font_size * baseline_shift;

    let mut tspans = String::new();
    for (index, line) in lines.iter().enumerate() {
        let dy = if index == 0 { first_dy } else { line_height };
        tspans.push_str(&format!(
            "<tspan x=\"{}\" dy=\"{}\">{}</tspan>",
            cx,
            dy,
            render_line_content(line)
        ));
    }

    format!(
        "<text x=\"{}\" y=\"{}\" {}>{}</text>",
        cx, cy, attrs, tspans
    )
}

pub fn render_multiline_text_with_background(
    text: &str,
    cx: f64,
    cy: f64,
    text_width: f64,
    text_height: f64,
    font_size: f64,
    padding: f64,
    text_attrs: &str,
    bg_attrs: &str,
) -> String {
    let bg_width = text_width + padding * 2.0;
    let bg_height = text_height + padding * 2.0;
    let rect = format!(
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" {} />",
        cx - bg_width / 2.0,
        cy - bg_height / 2.0,
        bg_width,
        bg_height,
        bg_attrs
    );
    let text_element =
        render_multiline_text(text, cx, cy, font_size, text_attrs, DEFAULT_BASELINE_SHIFT);
    format!("{}\n{}", rect, text_element)
}

fn strip_surrounding_quotes(input: &str) -> &str {
    if input.starts_with('"') && input.ends_with('"') {
        if input.len() <= 1 {
            ""
        } else {
            &input[1..input.len() - 1]
        }
    } else {
        input
    }
}

fn replace_br_tags(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = String::with_capacity(input.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'<' {
            if let Some(end) = parse_br_tag(input, index) {
                output.push('\n');
                index = end;
                continue;
            }
        }
        let ch = next_char(input, index);
        output.push(ch);
        index += ch.len_utf8();
    }

    output
}

fn parse_br_tag(input: &str, start: usize) -> Option<usize> {
    let bytes = input.as_bytes();
    if *bytes.get(start)? != b'<' {
        return None;
    }

    let mut index = start + 1;
    if bytes
        .get(index)
        .copied()
        .map(|byte| byte.to_ascii_lowercase())
        != Some(b'b')
    {
        return None;
    }
    index += 1;
    if bytes
        .get(index)
        .copied()
        .map(|byte| byte.to_ascii_lowercase())
        != Some(b'r')
    {
        return None;
    }
    index += 1;

    while bytes
        .get(index)
        .is_some_and(|byte| byte.is_ascii_whitespace())
    {
        index += 1;
    }
    if bytes.get(index) == Some(&b'/') {
        index += 1;
    }

    if bytes.get(index) != Some(&b'>') {
        return None;
    }
    Some(index + 1)
}

fn remove_simple_tags(input: &str, tags: &[&str]) -> String {
    let bytes = input.as_bytes();
    let mut output = String::with_capacity(input.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'<' {
            if let Some((end, _, _)) = parse_simple_tag(input, index, tags) {
                index = end;
                continue;
            }
        }
        let ch = next_char(input, index);
        output.push(ch);
        index += ch.len_utf8();
    }

    output
}

fn parse_simple_tag(input: &str, start: usize, tags: &[&str]) -> Option<(usize, usize, bool)> {
    let bytes = input.as_bytes();
    if *bytes.get(start)? != b'<' {
        return None;
    }

    let mut index = start + 1;
    let mut is_closing = false;
    if bytes.get(index) == Some(&b'/') {
        is_closing = true;
        index += 1;
    }

    let name_start = index;
    while bytes
        .get(index)
        .is_some_and(|byte| byte.is_ascii_alphabetic())
    {
        index += 1;
    }
    if index == name_start {
        return None;
    }

    let tag_name = &input[name_start..index];
    let tag_index = tags
        .iter()
        .position(|tag| tag_name.eq_ignore_ascii_case(tag))?;

    while bytes
        .get(index)
        .is_some_and(|byte| byte.is_ascii_whitespace())
    {
        index += 1;
    }
    if bytes.get(index) != Some(&b'>') {
        return None;
    }

    Some((index + 1, tag_index, is_closing))
}

fn replace_markdown_pair(input: &str, marker: &str, open_tag: &str, close_tag: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut cursor = 0;

    while cursor < input.len() {
        let Some(rel_start) = input[cursor..].find(marker) else {
            output.push_str(&input[cursor..]);
            break;
        };
        let start = cursor + rel_start;
        let content_start = start + marker.len();
        if content_start >= input.len() {
            output.push_str(&input[cursor..]);
            break;
        }

        let first_char = next_char(input, content_start);
        let search_from = content_start + first_char.len_utf8();
        let line_break_limit = find_first_line_terminator(input, content_start);
        let search_limit = line_break_limit.unwrap_or(input.len());

        if search_from > search_limit {
            output.push_str(&input[cursor..start + 1]);
            cursor = start + 1;
            continue;
        }

        if let Some(rel_end) = input[search_from..search_limit].find(marker) {
            let end = search_from + rel_end;
            output.push_str(&input[cursor..start]);
            output.push_str(open_tag);
            output.push_str(&input[content_start..end]);
            output.push_str(close_tag);
            cursor = end + marker.len();
        } else {
            output.push_str(&input[cursor..start + 1]);
            cursor = start + 1;
        }
    }

    output
}

fn replace_markdown_italic(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = String::with_capacity(input.len());
    let mut cursor = 0;
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] != b'*' {
            index += 1;
            continue;
        }

        if index > 0 && bytes[index - 1] == b'*' {
            index += 1;
            continue;
        }
        if index + 1 >= bytes.len() || bytes[index + 1] == b'*' {
            index += 1;
            continue;
        }

        let mut end = index + 1;
        while end < bytes.len() && bytes[end] != b'*' {
            end += 1;
        }
        if end >= bytes.len() {
            break;
        }
        if end + 1 < bytes.len() && bytes[end + 1] == b'*' {
            index += 1;
            continue;
        }

        let inner = &input[index + 1..end];
        if !is_valid_italic_inner(inner) {
            index += 1;
            continue;
        }

        output.push_str(&input[cursor..index]);
        output.push_str("<i>");
        output.push_str(inner);
        output.push_str("</i>");
        cursor = end + 1;
        index = end + 1;
    }

    output.push_str(&input[cursor..]);
    output
}

fn find_first_line_terminator(input: &str, from: usize) -> Option<usize> {
    input[from..]
        .char_indices()
        .find(|(_, ch)| matches!(ch, '\n' | '\r' | '\u{2028}' | '\u{2029}'))
        .map(|(offset, _)| from + offset)
}

fn is_valid_italic_inner(inner: &str) -> bool {
    if inner.is_empty() || inner.contains('*') {
        return false;
    }
    let mut chars = inner.chars();
    let first = chars.next().expect("inner is not empty");
    let last = inner.chars().next_back().expect("inner is not empty");
    !first.is_whitespace() && first != '*' && !last.is_whitespace() && last != '*'
}

fn contains_format_tag(line: &str) -> bool {
    let bytes = line.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'<' && parse_format_tag(line, index).is_some() {
            return true;
        }
        let ch = next_char(line, index);
        index += ch.len_utf8();
    }
    false
}

fn parse_format_tag(input: &str, start: usize) -> Option<(usize, FormatTag, bool)> {
    let (end, tag_index, is_closing) = parse_simple_tag(input, start, &FORMATTING_TAGS)?;
    let kind = match tag_index {
        0 | 1 => FormatTag::Bold,
        2 | 3 => FormatTag::Italic,
        4 => FormatTag::Underline,
        5 | 6 => FormatTag::Strikethrough,
        _ => return None,
    };
    Some((end, kind, is_closing))
}

fn parse_inline_formatting(line: &str) -> Vec<StyledSegment> {
    let bytes = line.as_bytes();
    let mut segments = Vec::new();
    let mut style = StyleState::default();
    let mut last_index = 0;
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'<' {
            if let Some((end, tag, is_closing)) = parse_format_tag(line, index) {
                if index > last_index {
                    segments.push(StyledSegment {
                        text: line[last_index..index].to_string(),
                        style,
                    });
                }
                match tag {
                    FormatTag::Bold => style.bold = !is_closing,
                    FormatTag::Italic => style.italic = !is_closing,
                    FormatTag::Underline => style.underline = !is_closing,
                    FormatTag::Strikethrough => style.strikethrough = !is_closing,
                }
                last_index = end;
                index = end;
                continue;
            }
        }
        let ch = next_char(line, index);
        index += ch.len_utf8();
    }

    if last_index < line.len() {
        segments.push(StyledSegment {
            text: line[last_index..].to_string(),
            style,
        });
    }

    segments
}

fn render_line_content(line: &str) -> String {
    if !contains_format_tag(line) {
        return escape_xml(line);
    }

    let segments = parse_inline_formatting(line);
    if segments.is_empty() {
        return String::new();
    }

    let all_plain = segments.iter().all(|segment| {
        !segment.style.bold
            && !segment.style.italic
            && !segment.style.underline
            && !segment.style.strikethrough
    });

    if all_plain {
        return segments
            .iter()
            .map(|segment| escape_xml(&segment.text))
            .collect::<Vec<String>>()
            .join("");
    }

    let mut output = String::new();
    for segment in &segments {
        let escaped = escape_xml(&segment.text);
        if !segment.style.bold
            && !segment.style.italic
            && !segment.style.underline
            && !segment.style.strikethrough
        {
            output.push_str(&escaped);
            continue;
        }

        let mut attrs = Vec::new();
        if segment.style.bold {
            attrs.push(String::from("font-weight=\"bold\""));
        }
        if segment.style.italic {
            attrs.push(String::from("font-style=\"italic\""));
        }
        let mut decorations = Vec::new();
        if segment.style.underline {
            decorations.push("underline");
        }
        if segment.style.strikethrough {
            decorations.push("line-through");
        }
        if !decorations.is_empty() {
            attrs.push(format!("text-decoration=\"{}\"", decorations.join(" ")));
        }
        output.push_str(&format!("<tspan {}>{}</tspan>", attrs.join(" "), escaped));
    }

    output
}

fn next_char(input: &str, index: usize) -> char {
    input[index..]
        .chars()
        .next()
        .expect("index is valid UTF-8 boundary")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_br_tags_handles_markdown_and_html() {
        assert_eq!(normalize_br_tags("a<br>b"), "a\nb");
        assert_eq!(normalize_br_tags("a<br/ >b"), "a<br/ >b");
        assert_eq!(normalize_br_tags("a\\nb"), "a\nb");
        assert_eq!(normalize_br_tags("\""), "");
        assert_eq!(normalize_br_tags("**text**"), "<b>text</b>");
        assert_eq!(
            normalize_br_tags("**a<br>b** and ~~x<br>y~~"),
            "**a\nb** and ~~x\ny~~"
        );
        assert_eq!(
            normalize_br_tags("**a\rb** and ~~x\ry~~"),
            "**a\rb** and ~~x\ry~~"
        );
        assert_eq!(
            normalize_br_tags("**a\u{2028}b** and ~~x\u{2029}y~~"),
            "**a\u{2028}b** and ~~x\u{2029}y~~"
        );
        assert_eq!(normalize_br_tags("*****"), "<b>*</b>");
        assert_eq!(normalize_br_tags("*a* 与 * a *"), "<i>a</i> 与 * a *");
        assert_eq!(normalize_br_tags("~~text~~"), "<s>text</s>");
        assert_eq!(normalize_br_tags("~~~~~"), "<s>~</s>");
        assert_eq!(normalize_br_tags("H<sub>2</sub>O"), "H2O");
    }

    #[test]
    fn strip_and_escape_follow_ts_behavior() {
        assert_eq!(
            strip_formatting_tags("<b>bold</b> <i>italic</i>"),
            "bold italic"
        );
        assert_eq!(escape_xml("& < > \" '"), "&amp; &lt; &gt; &quot; &#39;");
    }

    #[test]
    fn render_multiline_text_matches_expected_dy() {
        let rendered = render_multiline_text(
            "line1\nline2\nline3",
            100.0,
            80.0,
            16.0,
            "text-anchor=\"middle\"",
            0.35,
        );
        assert!(rendered.contains("dy=\"-15.200000000000001\""));
        assert_eq!(rendered.matches("dy=\"20.8\"").count(), 2);
    }
}
