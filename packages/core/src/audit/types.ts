
export interface AuditResult {
  url: string;
  transport: TransportDiagnostics;
  securityHeaders: SecurityHeadersResult;
  dns: DnsDiagnostics;
  performance: PerformanceMetrics;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: AuditIssue[];
}

export interface TransportDiagnostics {
  // TLS / SSL
  tlsVersion: string | null;
  cipherSuite: string | null;
  alpnProtocol: string | null; // http/1.1, h2
  certificate: CertificateInfo | null;

  // HTTP Protocol
  httpVersion: string;
  compression: string[]; // gzip, br, deflate
  keepAlive: boolean;
  transferEncoding: string | null;
  redirectCount: number;
  redirects: RedirectInfo[];
  serverHeader: string | null;
  headers: Record<string, string | string[] | undefined>;
}

export interface CertificateInfo {
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  isSelfSigned: boolean;
  isValidChain: boolean; // basic check, relying on node tls rejectUnauthorized: true result if possible, or manual check
  fingerprint: string;
  serialNumber: string;
  subjectAltName?: string;
}

export interface RedirectInfo {
  url: string;
  statusCode: number;
  location: string | null;
}

export interface SecurityHeadersResult {
  strictTransportSecurity: HeaderStatus;
  contentSecurityPolicy: HeaderStatus;
  xFrameOptions: HeaderStatus;
  xContentTypeOptions: HeaderStatus;
  referrerPolicy: HeaderStatus;
  permissionsPolicy: HeaderStatus;

  details: Record<string, string>; // raw values
  score: number; // partial score contribution (0-100 normalized for headers section)
}

export interface HeaderStatus {
  present: boolean;
  value: string | null;
  valid: boolean; // simple syntax check
  issues?: string[];
}

export interface DnsDiagnostics {
  a: string[];
  aaaa: string[];
  cname: string[];
  reverse: string[];
  ipCount: number;
  ipv6Support: boolean;
  resolutionTime: number;
}

export interface PerformanceMetrics {
  dnsLookupTime: number; // ms
  tcpConnectTime: number; // ms
  tlsHandshakeTime: number; // ms
  ttfb: number; // ms
  totalTime: number; // ms
  htmlSize: number; // bytes
  headerSize: number; // bytes
  redirectTime?: number; // accumulated time spent in redirects
}

export interface AuditIssue {
  id: string; // unique code for tests/filtering
  severity: 'critical' | 'severe' | 'moderate' | 'minor' | 'info';
  category: 'tls' | 'http' | 'headers' | 'dns' | 'performance';
  message: string;
  scorePenalty: number;
}

export interface AuditOptions {
  timeout?: number;
  verbose?: boolean;
  debug?: boolean;
  userAgent?: string;
}
