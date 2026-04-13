import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
    SlipVerificationService,
    SlipExtractedData,
} from '../slip-verification.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

const makeConfig = (overrides: Record<string, string | undefined> = {}) => ({
    get: jest.fn((key: string) => overrides[key]),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a fully populated SlipExtractedData */
function buildExtracted(overrides: Partial<SlipExtractedData> = {}): SlipExtractedData {
    return {
        amount: 1500,
        date: '2026-06-01',
        bank: 'KASIKORN',
        reference: 'TXN123456',
        senderAccount: '****1234',
        receiverAccount: '****5678',
        rawText: 'Transfer ฿1500 on 2026-06-01 REF TXN123456',
        ...overrides,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SlipVerificationService', () => {
    /** Build a test module with no OPENAI_API_KEY — uses mock extraction */
    async function buildModule(configOverrides: Record<string, string | undefined> = {}) {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SlipVerificationService,
                { provide: ConfigService, useValue: makeConfig(configOverrides) },
            ],
        }).compile();

        return module.get<SlipVerificationService>(SlipVerificationService);
    }

    // ── evaluate() — via private accessor ────────────────────────────────────

    describe('evaluate() — APPROVED', () => {
        it('approves when amount matches and confidence is high', async () => {
            const service = await buildModule();
            const extracted = buildExtracted({ amount: 1500 });

            // @ts-ignore — testing private method
            const result = service.evaluate(extracted, 1500);

            expect(result.decision).toBe('APPROVED');
            expect(result.matched).toBe(true);
            expect(result.confidence).toBeGreaterThanOrEqual(0.4);
        });

        it('approves when amount is within ±1 THB tolerance', async () => {
            const service = await buildModule();
            const extracted = buildExtracted({ amount: 1500.5 });

            // @ts-ignore
            const result = service.evaluate(extracted, 1500);

            expect(result.decision).toBe('APPROVED');
        });
    });

    describe('evaluate() — REJECTED', () => {
        it('rejects when amount does not match', async () => {
            const service = await buildModule();
            const extracted = buildExtracted({ amount: 999 });

            // @ts-ignore
            const result = service.evaluate(extracted, 1500);

            expect(result.decision).toBe('REJECTED');
            expect(result.matched).toBe(false);
            expect(result.reason).toContain('mismatch');
        });

        it('rejects when amount is null even with other confident fields', async () => {
            const service = await buildModule();
            const extracted = buildExtracted({ amount: null });

            // @ts-ignore
            const result = service.evaluate(extracted, 1500);

            // null amount → amountOk=false → REJECTED (confidence still ≥ 0.4 from other fields)
            expect(result.decision).toBe('REJECTED');
        });
    });

    describe('evaluate() — MANUAL_REVIEW', () => {
        it('returns MANUAL_REVIEW when rawText is OCR_ERROR', async () => {
            const service = await buildModule();
            const extracted = buildExtracted({
                rawText: 'OCR_ERROR',
                amount: 1500,         // amount matches, but rawText is error sentinel
            });

            // @ts-ignore
            const result = service.evaluate(extracted, 1500);

            expect(result.decision).toBe('MANUAL_REVIEW');
            expect(result.reason).toContain('manual review');
        });

        it('returns MANUAL_REVIEW when confidence < 0.4', async () => {
            const service = await buildModule();
            // rawText present but all other fields null → confidence = 0.2 (<0.4)
            const extracted: SlipExtractedData = {
                amount: null,
                date: null,
                bank: null,
                reference: null,
                senderAccount: null,
                receiverAccount: null,
                rawText: 'some text but nothing parseable',
            };

            // @ts-ignore
            const result = service.evaluate(extracted, 1500);

            expect(result.decision).toBe('MANUAL_REVIEW');
            expect(result.confidence).toBeLessThan(0.4);
        });
    });

    // ── verifySlip() — mock mode (no OpenAI key) ──────────────────────────────

    describe('verifySlip() — mock fallback', () => {
        it('approves the slip when OPENAI_API_KEY is absent (mock extraction)', async () => {
            const service = await buildModule(); // no API key

            const result = await service.verifySlip('http://example.com/slip.jpg', 2000);

            expect(result.decision).toBe('APPROVED');
            expect(result.extracted.amount).toBe(2000);
            expect(result.extracted.bank).toContain('MOCK');
        });
    });
});
