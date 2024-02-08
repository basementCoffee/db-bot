import { MessageEventLocal } from '../../../utils/lib/types';
import { getTemperature } from '../../../process/utils';

exports.run = async (event: MessageEventLocal) => {
  getTemperature().then((response) => {
    if (response.isError) event.message.channel.send(`returned error: \`${response.value}\``);
    else event.message.channel.send(`\`${response.value || 'error: no response value provided'}\``);
  });
};
