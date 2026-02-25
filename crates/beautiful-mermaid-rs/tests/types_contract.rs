use beautiful_mermaid_rs::types::{
    Direction, EdgeStyle, MermaidEdge, MermaidGraph, MermaidNode, MermaidSubgraph, NodeShape,
    Point, PositionedEdge, PositionedGraph, PositionedGroup, PositionedNode,
};
use indexmap::IndexMap;

#[test]
fn hyphenated_node_shape_literals_are_stable() {
    let literals = [
        (NodeShape::TrapezoidAlt, "\"trapezoid-alt\""),
        (NodeShape::StateStart, "\"state-start\""),
        (NodeShape::StateEnd, "\"state-end\""),
    ];

    for (shape, literal) in literals {
        let serialized = serde_json::to_string(&shape).expect("shape serialize");
        assert_eq!(serialized, literal);

        let roundtrip: NodeShape = serde_json::from_str(literal).expect("shape deserialize");
        assert_eq!(roundtrip, shape);
    }
}

#[test]
fn optional_fields_are_omitted_when_empty() {
    let positioned = PositionedGraph {
        width: 240.0,
        height: 160.0,
        nodes: vec![PositionedNode {
            id: "n1".into(),
            label: "N1".into(),
            shape: NodeShape::Rectangle,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 40.0,
            inline_style: None,
        }],
        edges: vec![PositionedEdge {
            source: "n1".into(),
            target: "n1".into(),
            label: None,
            style: EdgeStyle::Solid,
            has_arrow_start: false,
            has_arrow_end: true,
            points: vec![Point { x: 0.0, y: 0.0 }, Point { x: 80.0, y: 40.0 }],
            label_position: None,
        }],
        groups: vec![PositionedGroup {
            id: "g1".into(),
            label: "G1".into(),
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 100.0,
            children: vec![],
        }],
    };

    let graph = MermaidGraph {
        direction: Direction::TD,
        nodes: IndexMap::from([(
            "n1".into(),
            MermaidNode {
                id: "n1".into(),
                label: "N1".into(),
                shape: NodeShape::Rectangle,
            },
        )]),
        edges: vec![MermaidEdge {
            source: "n1".into(),
            target: "n1".into(),
            label: None,
            style: EdgeStyle::Solid,
            has_arrow_start: false,
            has_arrow_end: true,
        }],
        subgraphs: vec![MermaidSubgraph {
            id: "sg1".into(),
            label: "SG1".into(),
            node_ids: vec!["n1".into()],
            children: vec![],
            direction: None,
        }],
        class_defs: IndexMap::new(),
        class_assignments: IndexMap::new(),
        node_styles: IndexMap::new(),
    };

    let positioned_value = serde_json::to_value(&positioned).expect("positioned serialize");
    let node_obj = positioned_value["nodes"][0]
        .as_object()
        .expect("node object");
    assert!(!node_obj.contains_key("inlineStyle"));
    let edge_obj = positioned_value["edges"][0]
        .as_object()
        .expect("edge object");
    assert!(!edge_obj.contains_key("label"));
    assert!(!edge_obj.contains_key("labelPosition"));

    let graph_value = serde_json::to_value(&graph).expect("graph serialize");
    let subgraph_obj = graph_value["subgraphs"][0]
        .as_object()
        .expect("subgraph object");
    assert!(!subgraph_obj.contains_key("direction"));
}

#[test]
fn index_map_keeps_insertion_order_and_roundtrips() {
    let nodes = IndexMap::from([
        (
            "n1".into(),
            MermaidNode {
                id: "n1".into(),
                label: "N1".into(),
                shape: NodeShape::Rectangle,
            },
        ),
        (
            "n2".into(),
            MermaidNode {
                id: "n2".into(),
                label: "N2".into(),
                shape: NodeShape::Rounded,
            },
        ),
        (
            "n3".into(),
            MermaidNode {
                id: "n3".into(),
                label: "N3".into(),
                shape: NodeShape::Diamond,
            },
        ),
    ]);

    let graph = MermaidGraph {
        direction: Direction::LR,
        nodes,
        edges: vec![],
        subgraphs: vec![],
        class_defs: IndexMap::new(),
        class_assignments: IndexMap::new(),
        node_styles: IndexMap::new(),
    };

    let serialized = serde_json::to_string(&graph).expect("graph serialize");
    let p1 = serialized.find("\"n1\"").expect("n1");
    let p2 = serialized.find("\"n2\"").expect("n2");
    let p3 = serialized.find("\"n3\"").expect("n3");
    assert!(p1 < p2 && p2 < p3);

    let roundtrip: MermaidGraph = serde_json::from_str(&serialized).expect("graph deserialize");
    let keys: Vec<&str> = roundtrip.nodes.keys().map(|k| k.as_str()).collect();
    assert_eq!(keys, vec!["n1", "n2", "n3"]);
}
