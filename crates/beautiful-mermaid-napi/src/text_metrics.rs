use std::sync::OnceLock;

use napi_derive::napi;
use regex::Regex;

const NARROW_CHARS: &[&str] = &["i", "l", "t", "f", "j", "I", "1", "!", "|", ".", ",", ":", ";", "'"];
const WIDE_CHARS: &[&str] = &["W", "M", "w", "m", "@", "%"];
const VERY_WIDE_CHARS: &[&str] = &["W", "M"];
const SEMI_NARROW_PUNCT: &[&str] = &["(", ")", "[", "]", "{", "}", "/", "\\", "-", "\"", "`"];

const LINE_HEIGHT_RATIO: f64 = 1.3;
const MIN_PADDING_RATIO: f64 = 0.15;

static EMOJI_REGEX: OnceLock<Regex> = OnceLock::new();
static FORMAT_TAG_REGEX: OnceLock<Regex> = OnceLock::new();

#[napi(object)]
#[allow(non_snake_case)]
pub struct MultilineMetrics {
    pub width: f64,
    pub height: f64,
    pub lines: Vec<String>,
    pub lineHeight: f64,
}

fn emoji_regex() -> &'static Regex {
    EMOJI_REGEX.get_or_init(|| {
        Regex::new(r"\p{Emoji_Presentation}|\p{Extended_Pictographic}")
            .expect("emoji regex must be valid")
    })
}

fn format_tag_regex() -> &'static Regex {
    FORMAT_TAG_REGEX.get_or_init(|| {
        Regex::new(r"(?i)</?(?:b|strong|i|em|u|s|del)\s*>")
            .expect("format tag regex must be valid")
    })
}

fn is_combining_mark(code: u32) -> bool {
    (0x0300..=0x036f).contains(&code)
        || (0x1ab0..=0x1aff).contains(&code)
        || (0x1dc0..=0x1dff).contains(&code)
        || (0x20d0..=0x20ff).contains(&code)
        || (0xfe20..=0xfe2f).contains(&code)
}

fn is_fullwidth(code: u32) -> bool {
    (0x1100..=0x115f).contains(&code)
        || (0x2e80..=0x2eff).contains(&code)
        || (0x2f00..=0x2fdf).contains(&code)
        || (0x3000..=0x303f).contains(&code)
        || (0x3040..=0x309f).contains(&code)
        || (0x30a0..=0x30ff).contains(&code)
        || (0x3100..=0x312f).contains(&code)
        || (0x3130..=0x318f).contains(&code)
        || (0x3190..=0x31ff).contains(&code)
        || (0x3200..=0x33ff).contains(&code)
        || (0x3400..=0x4dbf).contains(&code)
        || (0x4e00..=0x9fff).contains(&code)
        || (0xac00..=0xd7af).contains(&code)
        || (0xf900..=0xfaff).contains(&code)
        || (0xff00..=0xff60).contains(&code)
        || (0xffe0..=0xffe6).contains(&code)
        || code >= 0x20000
}

fn is_emoji(text: &str) -> bool {
    emoji_regex().is_match(text)
}

fn base_ratio(font_weight: f64) -> f64 {
    if font_weight >= 600.0 {
        0.60
    } else if font_weight >= 500.0 {
        0.57
    } else {
        0.54
    }
}

fn strip_formatting_tags(text: &str) -> String {
    format_tag_regex().replace_all(text, "").into_owned()
}

fn get_char_width_impl(text: &str) -> f64 {
    let Some(first_char) = text.chars().next() else {
        return 0.0;
    };

    let code = first_char as u32;
    if is_combining_mark(code) {
        return 0.0;
    }

    if is_fullwidth(code) || is_emoji(text) {
        return 2.0;
    }

    if text == " " {
        return 0.3;
    }

    if VERY_WIDE_CHARS.contains(&text) {
        return 1.5;
    }

    if WIDE_CHARS.contains(&text) {
        return 1.2;
    }

    if NARROW_CHARS.contains(&text) {
        return 0.4;
    }

    if SEMI_NARROW_PUNCT.contains(&text) {
        return 0.5;
    }

    if text == "r" {
        return 0.8;
    }

    if (65..=90).contains(&code) {
        return 1.2;
    }

    if (48..=57).contains(&code) {
        return 1.0;
    }

    1.0
}

fn measure_text_width_impl(text: &str, font_size: f64, font_weight: f64) -> f64 {
    let mut total_width = 0.0;
    let mut buffer = [0_u8; 4];

    for ch in text.chars() {
        let char_text = ch.encode_utf8(&mut buffer);
        total_width += get_char_width_impl(char_text);
    }

    total_width * font_size * base_ratio(font_weight) + font_size * MIN_PADDING_RATIO
}

fn measure_multiline_text_impl(text: &str, font_size: f64, font_weight: f64) -> MultilineMetrics {
    let lines: Vec<String> = text.split('\n').map(ToString::to_string).collect();
    let line_height = font_size * LINE_HEIGHT_RATIO;

    let mut max_width = 0.0;
    for line in &lines {
        let plain = strip_formatting_tags(line);
        let width = measure_text_width_impl(&plain, font_size, font_weight);
        if width > max_width {
            max_width = width;
        }
    }

    MultilineMetrics {
        width: max_width,
        height: lines.len() as f64 * line_height,
        lines,
        lineHeight: line_height,
    }
}

#[napi(js_name = "getCharWidth")]
pub fn get_char_width(char: String) -> f64 {
    get_char_width_impl(&char)
}

#[napi(js_name = "measureTextWidth")]
pub fn measure_text_width(text: String, font_size: f64, font_weight: f64) -> f64 {
    measure_text_width_impl(&text, font_size, font_weight)
}

#[napi(js_name = "measureMultilineText")]
pub fn measure_multiline_text(text: String, font_size: f64, font_weight: f64) -> MultilineMetrics {
    measure_multiline_text_impl(&text, font_size, font_weight)
}
