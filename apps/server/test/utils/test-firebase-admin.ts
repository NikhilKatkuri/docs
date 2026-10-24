import { adminAuth } from '@/lib/firebase';
import { firebaseUID } from '@/modules/auth/validators/common';
import 'dotenv/config';
import { describe, expect, it } from 'vitest';

describe('Firebase UID Validation and Admin Service Tests', () => {
    describe('Zod Schema: firebaseUID', () => {
        it('should pass for a standard valid Firebase UID', () => {
            const validUid = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N';
            const result = firebaseUID.safeParse(validUid);
            expect(result.success).toBe(true);
        });

        it('should pass for a UID with surrounding whitespace (thanks to .trim())', () => {
            const paddedUid = '   user_uid_12345   ';
            const result = firebaseUID.safeParse(paddedUid);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe('user_uid_12345'); // Ensures it got trimmed
            }
        });

        it('should reject an empty string UID', () => {
            const result = firebaseUID.safeParse('');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]!.message).toBe('UID is required');
            }
        });

        it('should reject whitespace-only strings (trimmed down to empty)', () => {
            const result = firebaseUID.safeParse('     ');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]!.message).toBe('UID is required');
            }
        });

        it('should reject UIDs exceeding the 128-character limit', () => {
            const tooLongUid = 'a'.repeat(129);
            const result = firebaseUID.safeParse(tooLongUid);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]!.message).toBe('UID is too long');
            }
        });

        it('should pass for a UID exactly at the 128-character boundary', () => {
            const maxLenUid = 'b'.repeat(128);
            const result = firebaseUID.safeParse(maxLenUid);
            expect(result.success).toBe(true);
        });

        it('should reject non-string types (null, undefined, numbers, objects)', () => {
            expect(firebaseUID.safeParse(null).success).toBe(false);
            expect(firebaseUID.safeParse(undefined).success).toBe(false);
            expect(firebaseUID.safeParse(123456).success).toBe(false);
            expect(firebaseUID.safeParse({ uid: '123' }).success).toBe(false);
        });
    });

    describe('Firebase Admin: getAuth().getUser()', () => {
        const MOCK_VALID_UID = 'f7gTQ3getuTnhohwMApvxi5T6RN2';

        it('should successfully connect and retrieve an existing user', async () => {
            const user = await adminAuth.getUser(MOCK_VALID_UID);

            expect(user).toBeDefined();
            expect(user.uid).toBe(MOCK_VALID_UID);
            expect(user.email).toBeDefined();
        });

        it('should throw an error for a non-existent / invalid user UID', async () => {
            const nonExistentUid = 'nonExistentUserUid999999999';

            await expect(adminAuth.getUser(nonExistentUid)).rejects.toThrow(
                /There is no user record corresponding/
            );
        });

        it('should throw an error when passed a malformed or empty UID string', async () => {
            const malformedUid = '';

            await expect(adminAuth.getUser(malformedUid)).rejects.toThrow();
        });
    });
});
