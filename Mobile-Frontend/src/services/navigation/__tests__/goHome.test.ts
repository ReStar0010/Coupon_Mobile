import { goHome } from '../goHome';

/**
 * goHome must tear down the entire pushed flow (coupon detail/share/qr,
 * coupoint use) rather than push another (tabs) entry. Pushing left the
 * just-completed screen — whose full-screen success overlay blocks all
 * input and self-dismisses only via a timer — alive in the back stack, so
 * Android back returned the user to a permanently frozen "已分享！" overlay.
 */
describe('goHome', () => {
  it('dismisses the whole pushed stack when dismissal is possible', () => {
    const router = {
      canDismiss: jest.fn(() => true),
      dismissAll: jest.fn(),
      replace: jest.fn(),
    };

    goHome(router);

    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces with the home tab when there is nothing to dismiss', () => {
    const router = {
      canDismiss: jest.fn(() => false),
      dismissAll: jest.fn(),
      replace: jest.fn(),
    };

    goHome(router);

    expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
    expect(router.dismissAll).not.toHaveBeenCalled();
  });

  it('never uses push (which would stack duplicate home screens)', () => {
    const router = {
      canDismiss: jest.fn(() => true),
      dismissAll: jest.fn(),
      replace: jest.fn(),
      push: jest.fn(),
    };

    goHome(router);

    expect(router.push).not.toHaveBeenCalled();
  });
});
