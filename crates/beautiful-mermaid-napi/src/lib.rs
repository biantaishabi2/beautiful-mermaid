use napi::bindgen_prelude::Uint8Array;
use napi_derive::napi;

#[napi]
pub fn echo_buffer(input: Uint8Array) -> Uint8Array {
    input
}
