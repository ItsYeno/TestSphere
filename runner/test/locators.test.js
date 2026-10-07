import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeLocator, resolveLocator, toSelector, xpathLiteral } from '../src/locators.js';

// Laid out like the existing myMTN locator file.
const map = {
  HomePage: { defaultSwipeRight: { buyAirtime: 'Buy Airtime' } },
  buyAirtimePage: {
    forOthers: {
      selector: "//android.view.View[@content-desc='Buy For Others']/android.view.ViewGroup",
      newNumber: { phoneNumber: '//android.widget.EditText', proceed: 'Proceed' },
    },
  },
  SignInOptions: { PhoneLoginPage: { OTPPage: { changeNumber: 'new UiSelector().text("Change")' } } },
};

test('mobile selectors are read the way the old scripts used them', () => {
  assert.equal(toSelector('Buy Airtime', 'android'), '~Buy Airtime');
  assert.equal(toSelector('//android.widget.EditText', 'android'), '//android.widget.EditText');
  assert.equal(toSelector('new UiSelector().text("Change")', 'android'), 'android=new UiSelector().text("Change")');
  assert.equal(toSelector('id=login_input', 'android'), 'id=login_input');
  assert.equal(toSelector('~already', 'ios'), '~already');
});

test('web selectors pass through as CSS or XPath', () => {
  assert.equal(toSelector('#email', 'web'), '#email');
  assert.equal(toSelector('button.primary', 'web'), 'button.primary');
});

test('text locators become the right selector per platform', () => {
  assert.equal(toSelector({ text: 'Buy Airtime' }, 'android'), 'android=new UiSelector().text("Buy Airtime")');
  assert.equal(toSelector({ textContains: 'Air' }, 'ios'), '-ios predicate string:label CONTAINS "Air"');
  assert.equal(toSelector({ text: 'Sign in' }, 'web'), "//*[normalize-space(.)='Sign in'][not(.//*[normalize-space(.)='Sign in'])]");
  assert.equal(xpathLiteral(`it's "here"`), `concat('it', "'", 's "here"')`);
});

test('names resolve through the locator map, including groups with their own selector', () => {
  assert.deepEqual(resolveLocator('HomePage.defaultSwipeRight.buyAirtime', map, 'x'), { name: 'HomePage.defaultSwipeRight.buyAirtime', value: 'Buy Airtime' });
  assert.equal(resolveLocator('buyAirtimePage.forOthers', map, 'x').value, map.buyAirtimePage.forOthers.selector);
  assert.deepEqual(resolveLocator('button.primary', map, 'x'), { value: 'button.primary' });
  assert.deepEqual(resolveLocator({ text: 'Proceed' }, map, 'x'), { value: { text: 'Proceed' } });
});

test('a mistyped name fails with a suggestion instead of becoming a selector', () => {
  assert.throws(() => resolveLocator('HomePage.defaultSwipeRight.buyAirtme', map, 'step 1'), /no locator named .*Did you mean "HomePage.defaultSwipeRight.buyAirtime"/);
  assert.throws(() => resolveLocator('SignInOptions.PhoneLoginPage', map, 'step 1'), /group of locators/);
});

test('locators describe themselves by name, then text, then selector', () => {
  assert.equal(describeLocator({ name: 'login.email', value: '#email' }), 'login.email');
  assert.equal(describeLocator({ value: { text: 'Proceed' } }), '"Proceed"');
  assert.equal(describeLocator({ value: '#email' }), '#email');
});
