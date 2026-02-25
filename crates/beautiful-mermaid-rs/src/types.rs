use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Direction {
    #[serde(rename = "TD")]
    TD,
    #[serde(rename = "TB")]
    TB,
    #[serde(rename = "LR")]
    LR,
    #[serde(rename = "BT")]
    BT,
    #[serde(rename = "RL")]
    RL,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NodeShape {
    Rectangle,
    Rounded,
    Diamond,
    Stadium,
    Circle,
    Subroutine,
    Doublecircle,
    Hexagon,
    Cylinder,
    Asymmetric,
    Trapezoid,
    #[serde(rename = "trapezoid-alt")]
    TrapezoidAlt,
    #[serde(rename = "state-start")]
    StateStart,
    #[serde(rename = "state-end")]
    StateEnd,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EdgeStyle {
    Solid,
    Dotted,
    Thick,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MermaidGraph {
    pub direction: Direction,
    pub nodes: IndexMap<String, MermaidNode>,
    pub edges: Vec<MermaidEdge>,
    pub subgraphs: Vec<MermaidSubgraph>,
    pub class_defs: IndexMap<String, IndexMap<String, String>>,
    pub class_assignments: IndexMap<String, String>,
    pub node_styles: IndexMap<String, IndexMap<String, String>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MermaidNode {
    pub id: String,
    pub label: String,
    pub shape: NodeShape,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MermaidEdge {
    pub source: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub style: EdgeStyle,
    pub has_arrow_start: bool,
    pub has_arrow_end: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MermaidSubgraph {
    pub id: String,
    pub label: String,
    pub node_ids: Vec<String>,
    pub children: Vec<MermaidSubgraph>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<Direction>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionedGraph {
    pub width: f64,
    pub height: f64,
    pub nodes: Vec<PositionedNode>,
    pub edges: Vec<PositionedEdge>,
    pub groups: Vec<PositionedGroup>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionedNode {
    pub id: String,
    pub label: String,
    pub shape: NodeShape,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inline_style: Option<IndexMap<String, String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionedEdge {
    pub source: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub style: EdgeStyle,
    pub has_arrow_start: bool,
    pub has_arrow_end: bool,
    pub points: Vec<Point>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_position: Option<Point>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionedGroup {
    pub id: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub children: Vec<PositionedGroup>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bg: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fg: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub muted: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub surface: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_spacing: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layer_spacing: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component_spacing: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transparent: Option<bool>,
}
