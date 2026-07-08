/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { computeChatRightRailState } from '../../../browser/widget/chatRightRailContrib.js';

suite('ChatRightRailContrib', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('hides rail when chat transcript does not overflow', () => {
		assert.deepStrictEqual(computeChatRightRailState({
			scrollTop: 0,
			scrollHeight: 400,
			renderHeight: 400,
			contentHeight: 400,
			hasOverflow: false,
		}), { visible: false, thumbTop: 0, thumbHeight: 100, scrollPercent: 0 });
	});

	test('computes thumb position and height from chat scroll metrics', () => {
		const state = computeChatRightRailState({
			scrollTop: 300,
			scrollHeight: 1000,
			renderHeight: 400,
			contentHeight: 1000,
			hasOverflow: true,
		});

		assert.strictEqual(state.visible, true);
		assert.strictEqual(state.thumbHeight, 40);
		assert.strictEqual(state.thumbTop, 30);
		assert.strictEqual(state.scrollPercent, 50);
	});

	test('clamps scroll position and minimum thumb size', () => {
		const state = computeChatRightRailState({
			scrollTop: 5000,
			scrollHeight: 10000,
			renderHeight: 100,
			contentHeight: 10000,
			hasOverflow: true,
		});

		assert.strictEqual(state.visible, true);
		assert.strictEqual(state.thumbHeight, 6);
		assert.ok(state.thumbTop <= 94);
		assert.ok(state.scrollPercent <= 100);
	});
});
