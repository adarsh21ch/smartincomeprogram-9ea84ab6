/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  token,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code for Smart Income Program</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>Smart Income <span style={logoAccent}>Program</span></Text>
        </Section>
        <Heading style={h1}>Verify your email</Heading>
        <Text style={text}>
          Use the code below to verify your email address ({recipient}).
        </Text>
        <Section style={codeContainer}>
          <Text style={codeStyle}>{token || '------'}</Text>
        </Section>
        <Text style={expiry}>This code expires in 15 minutes.</Text>
        <Text style={footer}>
          If you didn't create an account on Smart Income Program, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '40px 25px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logoText = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0' }
const logoAccent = { color: '#FFD700' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 12px', textAlign: 'center' as const }
const text = { fontSize: '14px', color: '#6b7280', lineHeight: '1.6', margin: '0 0 24px', textAlign: 'center' as const }
const codeContainer = { background: '#fffbeb', borderRadius: '12px', padding: '20px', textAlign: 'center' as const, margin: '0 0 16px', border: '2px dashed #FFD700' }
const codeStyle = { fontFamily: "'SF Mono', Courier, monospace", fontSize: '36px', fontWeight: 'bold' as const, color: '#B8860B', letterSpacing: '8px', margin: '0' }
const expiry = { fontSize: '12px', color: '#9ca3af', textAlign: 'center' as const, margin: '0 0 32px' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0', textAlign: 'center' as const, borderTop: '1px solid #f3f4f6', paddingTop: '16px' }
