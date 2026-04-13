import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface SlipExtractedData {
  amount: number | null;
  date: string | null;           // ISO date string
  bank: string | null;
  reference: string | null;
  senderAccount: string | null;
  receiverAccount: string | null;
  rawText: string;
}

export interface SlipVerificationResult {
  extracted: SlipExtractedData;
  confidence: number;            // 0–1
  matched: boolean;
  decision: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  reason: string;
}

const PROMPT = `You are an OCR assistant specialising in Thai bank transfer slips.
Given this image, extract the following fields exactly:
- amount: the transferred amount as a number (no currency symbol), null if not found
- date: the transfer date as ISO-8601 (YYYY-MM-DD), null if not found
- bank: the name of the SENDING bank in English, null if not found
- reference: the transaction/reference number, null if not found
- senderAccount: sender account number (last 4 digits are fine), null if not found
- receiverAccount: receiver account number (last 4 digits are fine), null if not found
- rawText: all visible text on the slip, joined into a single string

Respond ONLY with valid JSON matching this exact shape:
{"amount":null,"date":null,"bank":null,"reference":null,"senderAccount":null,"receiverAccount":null,"rawText":""}`;

@Injectable()
export class SlipVerificationService {
  private readonly logger = new Logger(SlipVerificationService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI Vision initialised for slip verification');
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not set — slip verification will use mock fallback',
      );
    }
  }

  /**
   * Verify a payment slip image against an expected amount.
   * @param imageUrl  Publicly accessible URL of the slip image
   * @param expectedAmount  Amount expected from the booking/payment record
   */
  async verifySlip(
    imageUrl: string,
    expectedAmount: number,
  ): Promise<SlipVerificationResult> {
    let extracted: SlipExtractedData;

    if (this.openai) {
      extracted = await this.callOpenAIVision(imageUrl);
    } else {
      extracted = this.mockExtraction(expectedAmount);
    }

    return this.evaluate(extracted, expectedAmount);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async callOpenAIVision(imageUrl: string): Promise<SlipExtractedData> {
    try {
      const response = await this.openai!.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content ?? '';
      // Strip markdown code fences if present
      const json = content.replace(/```(?:json)?/g, '').trim();
      return JSON.parse(json) as SlipExtractedData;
    } catch (err) {
      this.logger.error(`OpenAI Vision failed: ${(err as Error).message}`);
      // Return a safe fallback that triggers MANUAL_REVIEW
      return {
        amount: null,
        date: null,
        bank: null,
        reference: null,
        senderAccount: null,
        receiverAccount: null,
        rawText: 'OCR_ERROR',
      };
    }
  }

  /**
   * Mock extraction for development when OPENAI_API_KEY is absent.
   * Simulates a successful match so the payment flow can be tested end-to-end.
   */
  private mockExtraction(expectedAmount: number): SlipExtractedData {
    const today = new Date().toISOString().slice(0, 10);
    return {
      amount: expectedAmount,
      date: today,
      bank: 'KASIKORN (MOCK)',
      reference: `MOCK-${Date.now()}`,
      senderAccount: '****1234',
      receiverAccount: '****5678',
      rawText: `[MOCK] Transfer ฿${expectedAmount} on ${today}`,
    };
  }

  private evaluate(
    extracted: SlipExtractedData,
    expectedAmount: number,
  ): SlipVerificationResult {
    // Amount comparison — allow ±1 THB rounding difference
    const amountOk =
      extracted.amount !== null &&
      Math.abs(extracted.amount - expectedAmount) <= 1;

    // Confidence heuristics
    let confidence = 0;
    if (extracted.rawText && extracted.rawText !== 'OCR_ERROR') confidence += 0.2;
    if (extracted.amount !== null) confidence += 0.3;
    if (extracted.date !== null) confidence += 0.2;
    if (extracted.reference !== null) confidence += 0.2;
    if (extracted.bank !== null) confidence += 0.1;

    let decision: SlipVerificationResult['decision'];
    let reason: string;

    if (confidence < 0.4 || extracted.rawText === 'OCR_ERROR') {
      decision = 'MANUAL_REVIEW';
      reason = 'OCR confidence too low — manual review required';
    } else if (!amountOk) {
      decision = 'REJECTED';
      reason = `Amount mismatch: expected ฿${expectedAmount}, got ฿${extracted.amount ?? 'unknown'}`;
    } else {
      decision = 'APPROVED';
      reason = `Amount ฿${extracted.amount} matches expected ฿${expectedAmount}`;
    }

    return {
      extracted,
      confidence: Math.min(confidence, 1),
      matched: amountOk,
      decision,
      reason,
    };
  }
}
