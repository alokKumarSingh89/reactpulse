import type { AccessibilityRuleId } from '@reactpulse/contracts';

/** ReactPulse-owned prose. Engine help/messages and page values never enter it.
 * Associations with WCAG remain evidence metadata, not compliance claims. */
export const ACCESSIBILITY_RULE_CATALOG = {
  'image-alt': [
    'Image alternative text needs attention',
    'An automated check detected an image without an appropriate text alternative.',
    'Provide a meaningful text alternative, or mark a purely decorative image appropriately.',
  ],
  'input-image-alt': [
    'Image input needs an accessible name',
    'An automated check detected an image input without an appropriate text alternative.',
    'Provide text describing the action performed by the image input.',
  ],
  label: [
    'Form control needs a label',
    'An automated check detected a form control without an associated accessible label.',
    'Associate a descriptive label with the control and verify it with assistive technology.',
  ],
  'button-name': [
    'Button needs an accessible name',
    'An automated check detected a button without an accessible name.',
    'Provide a name that describes the button action.',
  ],
  'link-name': [
    'Link needs an accessible name',
    'An automated check detected a link without an accessible name.',
    'Provide descriptive link text or an appropriate accessible name.',
  ],
  'select-name': [
    'Select control needs an accessible name',
    'An automated check detected a select control without an accessible name.',
    'Associate a descriptive label with the select control.',
  ],
  'color-contrast': [
    'Text contrast needs attention',
    'An automated check detected text contrast below the rule threshold.',
    'Review foreground and background colors and verify contrast in the rendered state.',
  ],
  'aria-valid-attr': [
    'ARIA attribute is not recognized',
    'An automated check detected an unrecognized ARIA attribute.',
    'Use supported ARIA attribute names and prefer native HTML semantics.',
  ],
  'aria-valid-attr-value': [
    'ARIA attribute value needs attention',
    'An automated check detected an invalid ARIA attribute value.',
    'Use a value supported by the attribute and verify referenced relationships.',
  ],
  'aria-required-attr': [
    'Required ARIA attribute is missing',
    'An automated check detected a role missing a required ARIA attribute.',
    'Provide the required states and properties for the role.',
  ],
  'aria-allowed-attr': [
    'ARIA attribute does not match its role',
    'An automated check detected an ARIA attribute unsupported by its role.',
    'Align ARIA attributes with the element role and prefer native semantics.',
  ],
  'aria-roles': [
    'ARIA role needs attention',
    'An automated check detected an invalid ARIA role.',
    'Use a recognized role appropriate to the element behavior.',
  ],
  'document-title': [
    'Document title needs attention',
    'An automated check detected a missing or empty document title.',
    'Provide a concise title identifying the page purpose.',
  ],
  'html-has-lang': [
    'Document language is missing',
    'An automated check detected a document without a declared language.',
    'Declare the primary language on the document root.',
  ],
  'html-lang-valid': [
    'Document language needs attention',
    'An automated check detected an invalid document language declaration.',
    'Use a valid language tag for the primary document language.',
  ],
  'heading-order': [
    'Heading hierarchy needs review',
    'An automated check detected a skipped heading level.',
    'Review heading levels so they express the document hierarchy.',
  ],
  'landmark-one-main': [
    'Main landmark needs attention',
    'An automated check detected a document without the expected main landmark structure.',
    'Provide a main landmark identifying the primary page content.',
  ],
  region: [
    'Content landmark coverage needs attention',
    'An automated check detected content outside recognized landmarks.',
    'Organize page content within appropriate semantic landmarks.',
  ],
  tabindex: [
    'Positive tab order needs review',
    'An automated check detected a positive tabindex value.',
    'Prefer natural document focus order and verify keyboard navigation.',
  ],
} as const satisfies Record<
  AccessibilityRuleId,
  readonly [string, string, string]
>;
