const { version } = require('../../../package.json');

// A class allowing for retrieval and change of the build number.
class BuildNumber {
  // the version number in build number format
  baseVersionStr;
  // must be two digits
  extensionStr;
  // the build number - autogenerated using the version, last two digits (extensionStr) are configurable
  buildNoStr;

  constructor() {
    this.baseVersionStr = version.split('.').map((x) => (x.length < 2 ? `0${x}` : x)).join('');
    this.extensionStr = '04';
    this.buildNoStr = `${this.baseVersionStr}${this.extensionStr}`;
  }

  /**
   * Returns the build number.
   * @returns {string}
   */
  getBuildNo() {
    return this.buildNoStr;
  }

  /**
   * Updates the build number with a new extension.
   * @param extension {string | number} The new extension.
   */
  updateBuildNo(extension) {
    this.extensionStr = extension.toString().length < 2 ? `0${extension}` : extension;
    this.buildNoStr = `${this.baseVersionStr}${this.extensionStr}`;
  }

  /**
   * Increments the build number.
   * @returns {boolean} If successful.
   */
  incrementBuildNo() {
    return this.modifyBuildNo(99, ((digit) => ++digit));
  }

  /**
   * Decrements the build number.
   * @returns {boolean} If successful.
   */
  decrementBuildNo() {
    return this.modifyBuildNo(0, ((digit) => --digit));
  }

  /**
   * Modifies the build number.
   * If the extension of the build number is equal to the invalidAmt amount, then it returns false.
   * Otherwise, the provided action is executed.
   * @param invalidAmt {number} An invalid extension number.
   * @param action {(number)=>number} An action that modifies the build number.
   * @returns {boolean} True if successful.
   */
  modifyBuildNo(invalidAmt, action) {
    let extensionNum = parseInt(this.extensionStr);
    if (extensionNum === invalidAmt) return false;
    extensionNum = action(extensionNum);
    if (extensionNum > 99 || extensionNum < 0) extensionNum = 0;
    this.updateBuildNo(extensionNum);
    return true;
  }
}

module.exports = new BuildNumber();
