export const initializeSocket = () => {
  game.socket.on('module.intoterica', (data) => {
    if (data.type === 'update') {
      if (data.action === 'newMessage' && game.settings.get('intoterica', 'enableSounds')) {
        const soundPath = window.IntotericaApp ? window.IntotericaApp.getSoundPath('mail') : game.settings.get('intoterica', 'soundMail');
        let volume = game.settings.get('intoterica', 'volumeNotification');
        
        // Apply Theme Scale
        if (window.IntotericaApp) {
            const themeKey = game.settings.get('intoterica', 'theme');
            const themeConfig = window.IntotericaApp.THEMES[themeKey];
            if (themeConfig && themeConfig.volumeScale) {
                volume = Math.min(1.0, volume * themeConfig.volumeScale);
            }
        }
        
        if (soundPath) foundry.audio.AudioHelper.play({src: soundPath, volume: volume, autoplay: true, loop: false}, false);
      }
      
      // Access the app instance via the window object to avoid circular dependencies
      if (window.IntotericaApp) {
        window.IntotericaApp.handleSocketUpdate();
      }
    }
    
    if (data.type === 'dispatch') {
      if (window.IntotericaApp) {
        window.IntotericaApp.handleDispatch(data);
      }
    }
  });
};
