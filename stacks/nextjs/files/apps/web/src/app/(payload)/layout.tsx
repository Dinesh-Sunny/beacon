/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { connection } from 'next/server'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './custom.css'

// Cache Components: the admin is an authenticated, per-request app, so skip instant-navigation
// validation for the whole segment (Payload's views read dates and request data while rendering).
// Re-check when upgrading Payload: https://github.com/payloadcms/payload/issues/18065
export const instant = false

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

// Payload's RootLayout reads the clock and the session while rendering; wait for a real request
// so Cache Components never tries to prerender it.
const Layout = async ({ children }: Args) => {
  await connection()
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  )
}

export default Layout
