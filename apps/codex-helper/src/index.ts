#!/usr/bin/env bun
const [, , mode, arg] = process.argv

function fail(message: string): never {
  console.error(JSON.stringify({ type: "error", message }))
  process.exit(1)
}

async function main() {
  switch (mode) {
    case "status": {
      const { runStatus } = await import("./status")
      console.log(JSON.stringify(await runStatus()))
      return
    }
    case "generate": {
      if (!arg) fail("generate requires a payload file path")
      const { runGenerate } = await import("./generate")
      console.log(JSON.stringify(await runGenerate(arg)))
      return
    }
    case "login": {
      const { runLogin } = await import("./login")
      await runLogin(arg, process.argv[4]) // method, optional payload file
      return
    }
    case "logout": {
      const { runLogout } = await import("./logout")
      console.log(JSON.stringify(await runLogout()))
      return
    }
    default:
      fail(`Unknown mode: ${mode ?? "<none>"}`)
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
