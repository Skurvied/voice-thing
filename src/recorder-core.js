(function (global) {
  'use strict';

  /**
   * Detect the current browser and whether it supports the File System Access API.
   * @returns {{ name: string, canDirectSave: boolean }}
   */
  function detectBrowser() {
    var ua = navigator.userAgent;
    var name = 'Unknown';

    if (ua.includes('Firefox')) name = 'Firefox';
    else if (ua.includes('Edg/')) name = 'Edge';
    else if (ua.includes('OPR/') || ua.includes('Opera')) name = 'Opera';
    else if (ua.includes('Brave')) name = 'Brave';
    else if (ua.includes('Arc')) name = 'Arc';
    else if (ua.includes('Chrome')) name = 'Chrome';
    else if (ua.includes('Safari')) name = 'Safari';

    return {
      name: name,
      canDirectSave: typeof global.showDirectoryPicker === 'function'
    };
  }

  /**
   * Parse a pipe-delimited script file into recorder entries.
   * @param {string} rawText
   * @returns {Array<{filename: string, text: string, displayName: string}>}
   */
  function parseScript(rawText) {
    var lines = rawText.split('\n').filter(function (line) { return line.trim(); });
    if (lines.length < 2) throw new Error('Script file is empty or has only a header row.');

    var entries = [];
    var seenFilenames = {};
    var duplicates = [];

    for (var i = 1; i < lines.length; i++) {
      var pipeIdx = lines[i].indexOf('|');
      if (pipeIdx === -1) continue;

      var filename = lines[i].slice(0, pipeIdx).trim();
      var text = lines[i].slice(pipeIdx + 1).trim();
      if (!filename || !text) continue;

      if (seenFilenames[filename]) {
        duplicates.push(filename);
      } else {
        seenFilenames[filename] = true;
      }

      var displayName = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 60);

      entries.push({ filename: filename, text: text, displayName: displayName });
    }

    if (duplicates.length > 0) {
      throw new Error('Duplicate filenames found: ' + duplicates.join(', '));
    }

    return entries;
  }

  function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function encodeWAV(samples, sampleRate) {
    var numSamples = samples.length;
    var bytesPerSample = 2;
    var dataSize = numSamples * bytesPerSample;
    var buffer = new ArrayBuffer(44 + dataSize);
    var view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);

    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    var dataOffset = 44;
    for (var i = 0; i < numSamples; i++) {
      var sample = Math.max(-1, Math.min(1, samples[i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(dataOffset, sample, true);
      dataOffset += 2;
    }

    return buffer;
  }

  function crc32(data) {
    var table = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var current = i;
      for (var j = 0; j < 8; j++) {
        current = (current & 1) ? (0xEDB88320 ^ (current >>> 1)) : (current >>> 1);
      }
      table[i] = current;
    }

    var bytes = new Uint8Array(data);
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function buildZip(entries) {
    var localParts = [];
    var centralParts = [];
    var offset = 0;
    var encoder = new TextEncoder();
    var entryCount = 0;

    entries.forEach(function (data, filename) {
      var nameBytes = encoder.encode(filename);
      var crc = crc32(data);
      var size = data.byteLength;

      var local = new ArrayBuffer(30 + nameBytes.length);
      var lv = new DataView(local);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      new Uint8Array(local, 30).set(nameBytes);

      localParts.push(local);
      localParts.push(data);

      var central = new ArrayBuffer(46 + nameBytes.length);
      var cv = new DataView(central);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      new Uint8Array(central, 46).set(nameBytes);

      centralParts.push(central);
      offset += 30 + nameBytes.length + size;
      entryCount++;
    });

    var centralDirOffset = offset;
    var centralDirSize = 0;
    for (var i = 0; i < centralParts.length; i++) {
      centralDirSize += centralParts[i].byteLength;
    }

    var eocd = new ArrayBuffer(22);
    var ev = new DataView(eocd);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entryCount, true);
    ev.setUint16(10, entryCount, true);
    ev.setUint32(12, centralDirSize, true);
    ev.setUint32(16, centralDirOffset, true);
    ev.setUint16(20, 0, true);

    return new Blob(localParts.concat(centralParts, eocd), { type: 'application/zip' });
  }

  function getSessionKey(scriptName, entries) {
    var firstLine = entries.length > 0 ? entries[0].text : '';
    var raw = scriptName + '|' + firstLine + '|' + entries.length;
    var hash = 0;

    for (var i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }

    return 'vlr_' + Math.abs(hash).toString(36);
  }

  function checkStorageAvailable() {
    try {
      global.localStorage.setItem('__vlr_test', '1');
      global.localStorage.removeItem('__vlr_test');
      return true;
    } catch (error) {
      return false;
    }
  }

  var api = {
    buildZip: buildZip,
    checkStorageAvailable: checkStorageAvailable,
    crc32: crc32,
    detectBrowser: detectBrowser,
    encodeWAV: encodeWAV,
    getSessionKey: getSessionKey,
    parseScript: parseScript,
    writeString: writeString
  };

  global.VoiceLineRecorderCore = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}(typeof window !== 'undefined' ? window : globalThis));
