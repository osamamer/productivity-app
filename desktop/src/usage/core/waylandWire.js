// The Wayland wire format, just enough for the idle-notify protocol: little-endian 32-bit
// words, a header of `object id` and `(size << 16) | opcode`, strings as length + NUL-terminated
// bytes padded to 4. File-descriptor arguments are not supported (this client needs none).

function uint(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value >>> 0);
    return buffer;
}

function string(value) {
    const bytes = Buffer.from(`${value}\0`, 'utf8');
    return Buffer.concat([uint(bytes.length), bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]);
}

function encodeMessage(objectId, opcode, args) {
    const body = Buffer.concat(args);
    const header = Buffer.alloc(8);
    header.writeUInt32LE(objectId, 0);
    header.writeUInt32LE(((8 + body.length) << 16) | opcode, 4);
    return Buffer.concat([header, body]);
}

/** Splits complete messages off the front of `buffer`; returns them and the unread rest. */
function decodeMessages(buffer) {
    const messages = [];
    let rest = buffer;
    while (rest.length >= 8) {
        const size = rest.readUInt32LE(4) >>> 16;
        if (size < 8 || rest.length < size) break;
        messages.push({ objectId: rest.readUInt32LE(0), opcode: rest.readUInt32LE(4) & 0xffff, body: rest.subarray(8, size) });
        rest = rest.subarray(size);
    }
    return { messages, rest };
}

/** Reads a wl_registry.global event body: `name`, `interface`, `version`. */
function decodeGlobal(body) {
    const length = body.readUInt32LE(4);
    const padded = length + ((4 - (length % 4)) % 4);
    return {
        name: body.readUInt32LE(0),
        interface: body.subarray(8, 8 + length - 1).toString('utf8'),
        version: body.readUInt32LE(8 + padded),
    };
}

module.exports = { uint, string, encodeMessage, decodeMessages, decodeGlobal };
