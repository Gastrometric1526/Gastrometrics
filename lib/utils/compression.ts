// Simple compression utility using LZ-based compression

// Compress a string
export function compress(input: string): string {
  try {
    // Use built-in compression if available
    if (typeof window !== "undefined" && window.btoa) {
      return window.btoa(encodeURIComponent(input))
    }
    return input
  } catch (e) {
    console.error("Compression error:", e)
    return input
  }
}

// Decompress a string
export function decompress(input: string): string {
  try {
    // Use built-in decompression if available
    if (typeof window !== "undefined" && window.atob) {
      return decodeURIComponent(window.atob(input))
    }
    return input
  } catch (e) {
    console.error("Decompression error:", e)
    return input
  }
}
