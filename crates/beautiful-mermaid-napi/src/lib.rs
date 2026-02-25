use napi::bindgen_prelude::Buffer;
use napi_derive::napi;

#[napi]
pub fn echo_buffer(input: Buffer) -> Buffer {
    input
}
