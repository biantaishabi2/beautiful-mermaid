use napi::bindgen_prelude::Uint8Array;
use napi_derive::napi;

use beautiful_mermaid_rs::utils::{
    escape_xml as rs_escape_xml, normalize_br_tags as rs_normalize_br_tags,
    render_multiline_text as rs_render_multiline_text,
    render_multiline_text_with_background as rs_render_multiline_text_with_background,
    strip_formatting_tags as rs_strip_formatting_tags,
};

mod text_metrics;

#[napi]
pub fn echo_buffer(input: Uint8Array) -> Uint8Array {
    input
}

#[napi(js_name = "normalizeBrTags")]
pub fn normalize_br_tags(label: String) -> String {
    rs_normalize_br_tags(&label)
}

#[napi(js_name = "stripFormattingTags")]
pub fn strip_formatting_tags(text: String) -> String {
    rs_strip_formatting_tags(&text)
}

#[napi(js_name = "escapeXml")]
pub fn escape_xml(text: String) -> String {
    rs_escape_xml(&text)
}

#[napi(js_name = "renderMultilineText")]
pub fn render_multiline_text(
    text: String,
    cx: f64,
    cy: f64,
    font_size: f64,
    attrs: String,
    baseline_shift: Option<f64>,
) -> String {
    rs_render_multiline_text(
        &text,
        cx,
        cy,
        font_size,
        &attrs,
        baseline_shift.unwrap_or(0.35),
    )
}

#[napi(js_name = "renderMultilineTextWithBackground")]
pub fn render_multiline_text_with_background(
    text: String,
    cx: f64,
    cy: f64,
    text_width: f64,
    text_height: f64,
    font_size: f64,
    padding: f64,
    text_attrs: String,
    bg_attrs: String,
) -> String {
    rs_render_multiline_text_with_background(
        &text,
        cx,
        cy,
        text_width,
        text_height,
        font_size,
        padding,
        &text_attrs,
        &bg_attrs,
    )
}
