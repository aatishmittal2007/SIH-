import {
  UserRole,
  CaseStatus,
  CasePriority,
  SourceType,
  SourceReliability,
  EvidenceType,
  EntityType,
  ExtractionMethod,
  CaseEntityRole,
  EventType,
  FeedbackAction,
  AlertType,
  SeverityLevel,
  AlertStatus,
  MatchType,
  MatchStatus,
  ContradictionStatus
} from '@prisma/client';

import bcrypt from 'bcryptjs';
import { config } from '../config/env';

export async function seedUsers() {
  const adminPassword = config.seedAdminPassword || 'AdminPass123!';
  const invPassword = 'Investigator123!';
  const anlPassword = 'Analyst123!';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const invHash = await bcrypt.hash(invPassword, 10);
  const anlHash = await bcrypt.hash(anlPassword, 10);

  const demoAdminHash = await bcrypt.hash('AdminPassword123!', 10);
  const demoInvHash = await bcrypt.hash('InvestigatorPassword123!', 10);
  const demoAnlHash = await bcrypt.hash('AnalystPassword123!', 10);

  return [
    {
      id: 'usr-admin-001',
      name: 'Chief Inspector Rajesh Sharma',
      email: config.seedAdminEmail || 'admin@tracex.gov.in',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    {
      id: 'usr-admin-003',
      name: 'Admin Demo',
      email: 'admin@tracex.gov',
      passwordHash: demoAdminHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    {
      id: 'usr-inv-002',
      name: 'Senior Analyst Priya Verma',
      email: 'priya.verma@tracex.gov.in',
      passwordHash: invHash,
      role: UserRole.INVESTIGATOR,
      isActive: true,
    },
    {
      id: 'usr-inv-003',
      name: 'Investigator Demo',
      email: 'investigator@tracex.gov',
      passwordHash: demoInvHash,
      role: UserRole.INVESTIGATOR,
      isActive: true,
    },
    {
      id: 'usr-inv-004',
      name: 'Investigator Demo IN',
      email: 'investigator@tracex.gov.in',
      passwordHash: invHash,
      role: UserRole.INVESTIGATOR,
      isActive: true,
    },
    {
      id: 'usr-anl-003',
      name: 'Cyber Intelligence Analyst Amit Patel',
      email: 'amit.patel@tracex.gov.in',
      passwordHash: anlHash,
      role: UserRole.ANALYST,
      isActive: true,
    },
    {
      id: 'usr-anl-004',
      name: 'Analyst Demo',
      email: 'analyst@tracex.gov',
      passwordHash: demoAnlHash,
      role: UserRole.ANALYST,
      isActive: true,
    },
  ];
}

export const seedCaseAssignments = [
  {
    id: 'ca-001',
    caseId: 'case-001',
    userId: 'usr-inv-002',
    assignedById: 'usr-admin-001',
  },
  {
    id: 'ca-002',
    caseId: 'case-001',
    userId: 'usr-anl-003',
    assignedById: 'usr-admin-001',
  },
  {
    id: 'ca-003',
    caseId: 'case-002',
    userId: 'usr-inv-002',
    assignedById: 'usr-admin-001',
  },
];

export const seedSources = [
  {
    id: 'src-001',
    name: 'Mumbai Police Cyber Cell FIR Database',
    type: SourceType.POLICE_REPORT,
    reliability: SourceReliability.HIGH,
    description: 'Official criminal FIR logs and witness statements from Mumbai Cyber Cell.',
  },
  {
    id: 'src-002',
    name: 'Telecom CDR Intelligence Feed',
    type: SourceType.CDR,
    reliability: SourceReliability.HIGH,
    description: 'Cellular Call Detail Records (CDR) and tower dumps from service providers.',
  },
  {
    id: 'src-003',
    name: 'Financial Intelligence Unit (FIU) Gateway',
    type: SourceType.FINANCIAL_RECORD,
    reliability: SourceReliability.HIGH,
    description: 'Bank transaction logs, SWIFT records, and Suspicious Transaction Reports (STR).',
  },
  {
    id: 'src-004',
    name: 'Darknet Market Scraping Engine (OSINT)',
    type: SourceType.DARK_WEB,
    reliability: SourceReliability.MEDIUM,
    description: 'Scraped forum postings, PGP keys, and crypto address mappings from darknet markets.',
  },
];

export const seedCases = [
  {
    id: 'case-001',
    caseNumber: 'TX-2024-001',
    title: 'Operation Black Lotus',
    description: 'Investigation into a multi-crore financial cyber fraud syndicate using fake KYC accounts and crypto conversion.',
    status: CaseStatus.ACTIVE,
    priority: CasePriority.CRITICAL,
    createdById: 'usr-admin-001',
  },
  {
    id: 'case-002',
    caseNumber: 'TX-2024-002',
    title: 'Operation Shadow Net',
    description: 'Takedown of an illegal SIM Box operation performing VoIP spoofing, identity theft, and extortion call routing.',
    status: CaseStatus.ACTIVE,
    priority: CasePriority.HIGH,
    createdById: 'usr-inv-002',
  },
  {
    id: 'case-003',
    caseNumber: 'TX-2024-003',
    title: 'Operation Dark Tide',
    description: 'Cross-border narcotics distribution network operating via Telegram channels and Monero/USDT crypto laundering.',
    status: CaseStatus.OPEN,
    priority: CasePriority.HIGH,
    createdById: 'usr-anl-003',
  },
];

export const seedEvidence = [
  // Case 1 Evidence
  {
    id: 'ev-001',
    caseId: 'case-001',
    type: EvidenceType.REPORT,
    title: 'FIR 402/2024 - Cyber Fraud Complaint',
    description: 'Initial police complaint filed by victim stating fraudulent transfer of ₹45,00,000 to HDFC Bank A/C 50100293849201.',
    fileName: 'FIR_402_2024_Cyber.pdf',
    storagePath: '/evidence/2024/case-001/FIR_402_2024_Cyber.pdf',
    mimeType: 'application/pdf',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sourceId: 'src-001',
    collectedAt: new Date('2024-05-10T09:30:00Z'),
  },
  {
    id: 'ev-002',
    caseId: 'case-001',
    type: EvidenceType.LOG,
    title: 'CDR Dump Target Line +919876543210',
    description: 'Call Detail Records showing incoming OTP SMS and cell tower pings near Mumbai Airport and Delhi NCR.',
    fileName: 'CDR_9876543210_May2024.csv',
    storagePath: '/evidence/2024/case-001/CDR_9876543210_May2024.csv',
    mimeType: 'text/csv',
    hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    sourceId: 'src-002',
    collectedAt: new Date('2024-05-12T15:45:00Z'),
  },
  {
    id: 'ev-003',
    caseId: 'case-001',
    type: EvidenceType.DOCUMENT,
    title: 'HDFC Bank KYC Audit File',
    description: 'Account opening form for A/C 50100293849201 showing registered owner Ramesh Kumar and Aadhaar proof.',
    fileName: 'HDFC_KYC_Audit_50100.pdf',
    storagePath: '/evidence/2024/case-001/HDFC_KYC_Audit_50100.pdf',
    mimeType: 'application/pdf',
    hash: 'f5e4d3c2b1a09876543210fedcba9876543210fedcba9876543210fedcba9876',
    sourceId: 'src-003',
    collectedAt: new Date('2024-05-14T11:20:00Z'),
  },

  // Case 2 Evidence
  {
    id: 'ev-004',
    caseId: 'case-002',
    type: EvidenceType.LOG,
    title: 'Telecom Raid SIM Box Hardware Inventory',
    description: 'Seizure report listing 128-port SIM gateway, 250 active SIM cards, and ISP router IP logs.',
    fileName: 'SIM_Box_Seizure_Log.json',
    storagePath: '/evidence/2024/case-002/SIM_Box_Seizure_Log.json',
    mimeType: 'application/json',
    hash: '778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566',
    sourceId: 'src-001',
    collectedAt: new Date('2024-05-18T18:00:00Z'),
  },
  {
    id: 'ev-005',
    caseId: 'case-002',
    type: EvidenceType.DOCUMENT,
    title: 'IndiGo Flight Manifest IG-604',
    description: 'Official airline passenger manifest showing Vikram Malhotra booked on flight IG-604 from Delhi to Dubai on 2024-05-12.',
    fileName: 'IndiGo_IG604_Manifest.pdf',
    storagePath: '/evidence/2024/case-002/IndiGo_IG604_Manifest.pdf',
    mimeType: 'application/pdf',
    hash: '9900aabbccddeeff11223344556677889900aabbccddeeff1122334455667788',
    sourceId: 'src-001',
    collectedAt: new Date('2024-05-20T10:00:00Z'),
  },

  // Case 3 Evidence
  {
    id: 'ev-006',
    caseId: 'case-003',
    type: EvidenceType.TRANSACTION,
    title: 'Binance Crypto Wallet Ledger Dump',
    description: 'Blockchain ledger extract for wallet 0x71C7656EC7ab88b098defB751B7401B5f6d8976F showing transfers of $120,000 USDT.',
    fileName: 'Binance_Ledger_Wallet_0x71C.csv',
    storagePath: '/evidence/2024/case-003/Binance_Ledger_Wallet_0x71C.csv',
    mimeType: 'text/csv',
    hash: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
    sourceId: 'src-004',
    collectedAt: new Date('2024-05-22T14:30:00Z'),
  },
];

export const seedEntities = [
  // Persons
  {
    id: 'ent-person-001',
    type: EntityType.PERSON,
    canonicalValue: 'Vikram Malhotra',
    displayName: 'Vikram "Viper" Malhotra',
    normalizedValue: 'vikram malhotra',
  },
  {
    id: 'ent-person-002',
    type: EntityType.PERSON,
    canonicalValue: 'Ramesh Kumar',
    displayName: 'Ramesh Kumar',
    normalizedValue: 'ramesh kumar',
  },
  {
    id: 'ent-person-003',
    type: EntityType.PERSON,
    canonicalValue: 'Siddharth Mehta',
    displayName: 'Siddharth "Shadow" Mehta',
    normalizedValue: 'siddharth mehta',
  },

  // Organizations
  {
    id: 'ent-org-001',
    type: EntityType.ORGANIZATION,
    canonicalValue: 'Aether Holdings Corp',
    displayName: 'Aether Holdings Corp',
    normalizedValue: 'aether holdings corp',
  },
  {
    id: 'ent-org-002',
    type: EntityType.ORGANIZATION,
    canonicalValue: 'Apex Global Logistics',
    displayName: 'Apex Global Logistics Pvt Ltd',
    normalizedValue: 'apex global logistics',
  },

  // Phone Numbers (BRIDGE ENTITY 1)
  {
    id: 'ent-phone-001',
    type: EntityType.PHONE,
    canonicalValue: '+919876543210',
    displayName: '+91 98765 43210',
    normalizedValue: '+919876543210',
  },
  {
    id: 'ent-phone-002',
    type: EntityType.PHONE,
    canonicalValue: '+919123456789',
    displayName: '+91 91234 56789',
    normalizedValue: '+919123456789',
  },

  // Crypto Wallets & Accounts (BRIDGE ENTITY 2)
  {
    id: 'ent-account-001',
    type: EntityType.ACCOUNT,
    canonicalValue: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    displayName: 'USDT Wallet (0x71C...976F)',
    normalizedValue: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  },
  {
    id: 'ent-account-002',
    type: EntityType.ACCOUNT,
    canonicalValue: 'HDFC-50100293849201',
    displayName: 'HDFC A/C 50100293849201',
    normalizedValue: 'hdfc-50100293849201',
  },

  // IP Addresses (BRIDGE ENTITY 3)
  {
    id: 'ent-ip-001',
    type: EntityType.IP_ADDRESS,
    canonicalValue: '45.132.228.12',
    displayName: 'IP 45.132.228.12 (VPN Endpoint)',
    normalizedValue: '45.132.228.12',
  },

  // Locations
  {
    id: 'ent-loc-001',
    type: EntityType.LOCATION,
    canonicalValue: 'Mumbai Cyber Cell Tower Zone 4',
    displayName: 'Bandra Kurla Complex, Mumbai',
    normalizedValue: 'bandra kurla complex mumbai',
  },
  {
    id: 'ent-loc-002',
    type: EntityType.LOCATION,
    canonicalValue: 'Indira Gandhi International Airport Delhi',
    displayName: 'IGI Airport Terminal 3, New Delhi',
    normalizedValue: 'igi airport terminal 3 new delhi',
  },
];

export const seedLocations = [
  {
    id: 'loc-001',
    entityId: 'ent-loc-001',
    latitude: 19.0657,
    longitude: 72.8687,
    address: 'BKC Road, Bandra East',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
  },
  {
    id: 'loc-002',
    entityId: 'ent-loc-002',
    latitude: 28.5562,
    longitude: 77.1000,
    address: 'Terminal 3, IGI Airport',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
  },
];

export const seedEntityMentions = [
  // Mentions in EV-001 (FIR report)
  {
    id: 'em-001',
    entityId: 'ent-person-001', // Vikram Malhotra
    evidenceId: 'ev-001',
    caseId: 'case-001',
    originalText: 'Vikram Malhotra',
    context: 'Suspect Vikram Malhotra intercepted victim transaction details.',
    extractionMethod: ExtractionMethod.NER,
    extractionConfidence: 0.94,
    startOffset: 120,
    endOffset: 135,
  },
  {
    id: 'em-002',
    entityId: 'ent-phone-001', // +919876543210
    evidenceId: 'ev-001',
    caseId: 'case-001',
    originalText: '+91-9876543210',
    context: 'OTP SMS was rerouted to mobile number +91-9876543210.',
    extractionMethod: ExtractionMethod.RULE,
    extractionConfidence: 0.99,
    startOffset: 210,
    endOffset: 224,
  },
  {
    id: 'em-003',
    entityId: 'ent-account-002', // HDFC A/C
    evidenceId: 'ev-001',
    caseId: 'case-001',
    originalText: '50100293849201',
    context: 'Funds transferred directly into HDFC bank account 50100293849201.',
    extractionMethod: ExtractionMethod.RULE,
    extractionConfidence: 0.98,
    startOffset: 310,
    endOffset: 324,
  },

  // Mentions in EV-002 (CDR)
  {
    id: 'em-004',
    entityId: 'ent-phone-001', // +919876543210 (Case 1)
    evidenceId: 'ev-002',
    caseId: 'case-001',
    originalText: '9876543210',
    context: 'Target CDR log for 9876543210 active at BKC Mumbai cell tower.',
    extractionMethod: ExtractionMethod.IMPORT,
    extractionConfidence: 1.0,
    startOffset: 0,
    endOffset: 10,
  },
  {
    id: 'em-005',
    entityId: 'ent-loc-001', // Mumbai BKC
    evidenceId: 'ev-002',
    caseId: 'case-001',
    originalText: 'Bandra Kurla Complex',
    context: 'Cell tower ping located at Bandra Kurla Complex at 14:30 IST on 2024-05-12.',
    extractionMethod: ExtractionMethod.NER,
    extractionConfidence: 0.91,
    startOffset: 45,
    endOffset: 65,
  },

  // Mentions in EV-004 (SIM Box - Case 2)
  {
    id: 'em-006',
    entityId: 'ent-phone-001', // +919876543210 (BRIDGE IN CASE 2)
    evidenceId: 'ev-004',
    caseId: 'case-002',
    originalText: '+919876543210',
    context: 'SIM card registered under +919876543210 recovered from SIM Box Gateway Slot 14.',
    extractionMethod: ExtractionMethod.RULE,
    extractionConfidence: 0.99,
    startOffset: 80,
    endOffset: 93,
  },
  {
    id: 'em-007',
    entityId: 'ent-ip-001', // IP 45.132.228.12
    evidenceId: 'ev-004',
    caseId: 'case-002',
    originalText: '45.132.228.12',
    context: 'Control panel accessed via proxy IP 45.132.228.12.',
    extractionMethod: ExtractionMethod.RULE,
    extractionConfidence: 0.99,
    startOffset: 140,
    endOffset: 153,
  },

  // Mentions in EV-005 (Flight Manifest - Case 2)
  {
    id: 'em-008',
    entityId: 'ent-person-001', // Vikram Malhotra
    evidenceId: 'ev-005',
    caseId: 'case-002',
    originalText: 'Vikram Malhotra',
    context: 'Passenger Vikram Malhotra checked in for IndiGo IG-604 to Dubai at Delhi IGI Airport at 14:00 IST on 2024-05-12.',
    extractionMethod: ExtractionMethod.IMPORT,
    extractionConfidence: 1.0,
    startOffset: 50,
    endOffset: 65,
  },

  // Mentions in EV-006 (Crypto Dump - Case 3)
  {
    id: 'em-009',
    entityId: 'ent-account-001', // Wallet 0x71C...
    evidenceId: 'ev-006',
    caseId: 'case-003',
    originalText: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    context: 'Monero converted to USDT and sent to wallet 0x71C7656EC7ab88b098defB751B7401B5f6d8976F.',
    extractionMethod: ExtractionMethod.RULE,
    extractionConfidence: 1.0,
    startOffset: 100,
    endOffset: 142,
  },
  {
    id: 'em-010',
    entityId: 'ent-org-001', // Aether Holdings
    evidenceId: 'ev-006',
    caseId: 'case-003',
    originalText: 'Aether Holdings',
    context: 'Wallet linked to KYC entity Aether Holdings Corp.',
    extractionMethod: ExtractionMethod.LLM,
    extractionConfidence: 0.88,
    startOffset: 180,
    endOffset: 195,
  },
];

export const seedCaseEntities = [
  // Case 1 Entities
  {
    id: 'ce-001',
    caseId: 'case-001',
    entityId: 'ent-person-001',
    role: CaseEntityRole.SUBJECT,
    confidence: 0.95,
    firstSeenAt: new Date('2024-05-10T00:00:00Z'),
    lastSeenAt: new Date('2024-05-14T00:00:00Z'),
  },
  {
    id: 'ce-002',
    caseId: 'case-001',
    entityId: 'ent-phone-001',
    role: CaseEntityRole.DEVICE,
    confidence: 0.99,
    firstSeenAt: new Date('2024-05-10T00:00:00Z'),
  },
  {
    id: 'ce-003',
    caseId: 'case-001',
    entityId: 'ent-account-002',
    role: CaseEntityRole.ACCOUNT,
    confidence: 0.98,
    firstSeenAt: new Date('2024-05-10T00:00:00Z'),
  },
  {
    id: 'ce-004',
    caseId: 'case-001',
    entityId: 'ent-person-002',
    role: CaseEntityRole.SUBJECT,
    confidence: 0.85,
    firstSeenAt: new Date('2024-05-14T00:00:00Z'),
  },

  // Case 2 Entities
  {
    id: 'ce-005',
    caseId: 'case-002',
    entityId: 'ent-phone-001', // BRIDGE
    role: CaseEntityRole.DEVICE,
    confidence: 0.99,
    firstSeenAt: new Date('2024-05-18T00:00:00Z'),
  },
  {
    id: 'ce-006',
    caseId: 'case-002',
    entityId: 'ent-person-001', // BRIDGE
    role: CaseEntityRole.SUBJECT,
    confidence: 0.90,
    firstSeenAt: new Date('2024-05-20T00:00:00Z'),
  },
  {
    id: 'ce-007',
    caseId: 'case-002',
    entityId: 'ent-ip-001',
    role: CaseEntityRole.DEVICE,
    confidence: 0.92,
    firstSeenAt: new Date('2024-05-18T00:00:00Z'),
  },

  // Case 3 Entities
  {
    id: 'ce-008',
    caseId: 'case-003',
    entityId: 'ent-account-001', // BRIDGE
    role: CaseEntityRole.ACCOUNT,
    confidence: 0.97,
    firstSeenAt: new Date('2024-05-22T00:00:00Z'),
  },
  {
    id: 'ce-009',
    caseId: 'case-003',
    entityId: 'ent-org-001',
    role: CaseEntityRole.SUBJECT,
    confidence: 0.89,
    firstSeenAt: new Date('2024-05-22T00:00:00Z'),
  },
  {
    id: 'ce-010',
    caseId: 'case-003',
    entityId: 'ent-person-003',
    role: CaseEntityRole.SUBJECT,
    confidence: 0.91,
    firstSeenAt: new Date('2024-05-22T00:00:00Z'),
  },
];

export const seedEvents = [
  {
    id: 'evt-001',
    caseId: 'case-001',
    type: EventType.TRANSACTION,
    description: 'Fraudulent fund transfer of ₹45,00,000 from victim bank to HDFC account.',
    timestamp: new Date('2024-05-10T09:15:00Z'),
    locationEntityId: 'ent-loc-001',
    sourceId: 'src-001',
    confidence: 0.98,
  },
  {
    id: 'evt-002',
    caseId: 'case-001',
    type: EventType.COMMUNICATION,
    description: 'Cell tower ping of +919876543210 in Mumbai BKC region.',
    timestamp: new Date('2024-05-12T14:30:00Z'),
    locationEntityId: 'ent-loc-001',
    sourceId: 'src-002',
    confidence: 0.95,
  },
  {
    id: 'evt-003',
    caseId: 'case-002',
    type: EventType.TRAVEL,
    description: 'Alleged international departure on IndiGo IG-604 Delhi to Dubai.',
    timestamp: new Date('2024-05-12T14:00:00Z'),
    locationEntityId: 'ent-loc-002',
    sourceId: 'src-001',
    confidence: 0.90,
  },
];

export const seedEntityMatches = [
  {
    id: 'ematch-001',
    sourceEntityId: 'ent-person-001', // Vikram Malhotra
    targetEntityId: 'ent-person-003', // Siddharth Mehta
    matchType: MatchType.CONTEXTUAL,
    similarityScore: 0.82,
    reason: 'Both entities share control of Aether Holdings Corp and access wallet 0x71C7656EC7ab88b098defB751B7401B5f6d8976F.',
    status: MatchStatus.PENDING,
  },
];

export const seedContradictions = [
  {
    id: 'contra-001',
    caseId: 'case-001',
    type: 'IMPOSSIBLE_TRAVEL_TIMELINE',
    description: 'Suspect Vikram Malhotra is shown pinging Mumbai cell tower at 14:30 IST while simultaneously listed on Delhi flight manifest to Dubai departing 14:00 IST.',
    severity: SeverityLevel.CRITICAL,
    status: ContradictionStatus.ACTIVE,
  },
  {
    id: 'contra-002',
    caseId: 'case-001',
    type: 'KYC_BENEFICIARY_MISMATCH',
    description: 'HDFC account KYC document specifies Ramesh Kumar, but transaction routing lists beneficiary as Aether Holdings Corp.',
    severity: SeverityLevel.HIGH,
    status: ContradictionStatus.ACTIVE,
  },
];

export const seedContradictionClaims = [
  {
    id: 'claim-001',
    contradictionId: 'contra-001',
    evidenceId: 'ev-002', // CDR
    entityId: 'ent-person-001',
    claimText: 'Cell tower CDR ping records phone +919876543210 in Mumbai BKC zone at 14:30:15 IST.',
    value: 'Location: Mumbai (19.0657, 72.8687)',
    timestamp: new Date('2024-05-12T14:30:15Z'),
  },
  {
    id: 'claim-002',
    contradictionId: 'contra-001',
    evidenceId: 'ev-005', // Flight manifest
    entityId: 'ent-person-001',
    claimText: 'Airline departure manifest records passenger boarding at Delhi IGI Airport at 14:00:00 IST.',
    value: 'Location: Delhi (28.5562, 77.1000)',
    timestamp: new Date('2024-05-12T14:00:00Z'),
  },
];

export const seedAlerts = [
  {
    id: 'alert-001',
    type: AlertType.NEW_CONNECTION,
    severity: SeverityLevel.HIGH,
    title: 'Cross-Case Bridge Entity Detected',
    description: 'Phone number +919876543210 links Operation Black Lotus (TX-2024-001) and Operation Shadow Net (TX-2024-002).',
    caseId: 'case-001',
    entityId: 'ent-phone-001',
    status: AlertStatus.ACTIVE,
  },
  {
    id: 'alert-002',
    type: AlertType.CONTRADICTION,
    severity: SeverityLevel.CRITICAL,
    title: 'Impossible Travel Timeline Flagged',
    description: 'Vikram Malhotra location conflict flagged between CDR records and flight manifest on 2024-05-12.',
    caseId: 'case-001',
    entityId: 'ent-person-001',
    status: AlertStatus.ACTIVE,
  },
];
