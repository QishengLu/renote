import React, { useEffect, useCallback, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Text, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { wsClient } from '../services/websocket';
import { useConnectionStore } from '../store/connectionStore';
import { useFilesStore, GitFileStatus } from '../store/filesStore';
import FileTree from './FileTree';
import FileViewer from './FileViewer';
import GitFileList from './GitFileList';
import GitDiffViewer from './GitDiffViewer';
import { colors, spacing, typography, radius, animation } from '../theme';

export default function FilesTab() {
  const [showPathModal, setShowPathModal] = useState(false);
  const [tempPath, setTempPath] = useState('');

  const {
    fileTree,
    selectedFile,
    currentPath,
    rootPath,
    loading,
    error,
    viewMode,
    isGitRepo,
    gitFiles,
    gitLoading,
    diffContent,
    diffFilePath,
    diffLoading,
    truncated,
    accessErrors,
    setSelectedFile,
    pushPath,
    goBack,
    toggleViewMode,
    clearDiff,
  } = useFilesStore();

  // Load file tree and check git repo on first mount or when connection is restored
  const { status } = useConnectionStore();
  const isConnected = status.ws === 'connected';

  useEffect(() => {
    if (isConnected) {
      if (!fileTree) {
        loadFileTree();
      }
      wsClient.requestGitCheckRepo();
    }
  }, [isConnected]);

  // Update temp path when rootPath changes
  useEffect(() => {
    if (rootPath) {
      setTempPath(rootPath);
    }
  }, [rootPath]);

  const loadFileTree = () => {
    wsClient.requestFileTree();
  };

  const handleChangePath = () => {
    if (tempPath.trim()) {
      wsClient.requestFileTree(tempPath.trim());
      setShowPathModal(false);
    }
  };

  const handleFileSelect = useCallback((path: string, type: 'file' | 'directory') => {
    if (type === 'file') {
      // If we have a rootPath and the path is relative (which it usually is from FileTree),
      // we need to construct the absolute path for the server to read it correctly.
      const fullPath = rootPath && !path.startsWith('/')
        ? `${rootPath.replace(/\/$/, '')}/${path}`
        : path;
      setSelectedFile(fullPath);
    } else {
      pushPath(path);
    }
  }, [setSelectedFile, pushPath, rootPath]);

  const handleBack = useCallback(() => {
    goBack();
  }, [goBack]);

  // Git mode: request status when switching to git mode
  const handleToggleMode = useCallback(() => {
    const nextMode = viewMode === 'normal' ? 'git' : 'normal';
    toggleViewMode();
    if (nextMode === 'git') {
      wsClient.requestGitStatus();
    }
  }, [viewMode, toggleViewMode]);

  // Git mode: handle file press to show diff
  const handleGitFilePress = useCallback((file: GitFileStatus) => {
    wsClient.requestFileDiff(file.path, file.staged);
  }, []);

  // Git mode: refresh status
  const handleGitRefresh = useCallback(() => {
    wsClient.requestGitStatus();
  }, []);

  // Render mode toggle button
  const renderModeToggle = () => {
    if (!isGitRepo) return null;

    return (
      <TouchableOpacity
        style={styles.modeToggle}
        onPress={handleToggleMode}
        activeOpacity={animation.activeOpacity}
      >
        <Text style={styles.modeToggleText}>
          {viewMode === 'normal' ? 'Git' : 'Files'}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render path input modal
  const renderPathModal = () => {
    return (
      <Modal
        visible={showPathModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPathModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Directory</Text>
            <Text style={styles.modalSubtitle}>Enter absolute path used on server:</Text>
            
            <TextInput
              style={styles.input}
              value={tempPath}
              onChangeText={setTempPath}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="/path/to/directory"
              placeholderTextColor={colors.text.tertiary}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPathModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleChangePath}
              >
                <Text style={styles.confirmButtonText}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // Render warning banner for truncated tree or access errors
  const renderWarningBanner = () => {
    if (!truncated && accessErrors.length === 0) return null;

    return (
      <View style={styles.warningBanner}>
        {truncated && (
          <View style={styles.warningItem}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              File tree truncated. Some directories not shown. Expand folders to load more.
            </Text>
          </View>
        )}
        {accessErrors.length > 0 && (
          <View style={styles.warningItem}>
            <Text style={styles.warningIcon}>🔒</Text>
            <Text style={styles.warningText}>
              {accessErrors.length} {accessErrors.length === 1 ? 'directory' : 'directories'} with permission denied
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Loading state (only for initial file tree load)
  if (loading && viewMode === 'normal') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading files...</Text>
      </View>
    );
  }

  // Error state
  if (error && viewMode === 'normal') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  // Git mode: viewing diff
  if (viewMode === 'git' && diffFilePath) {
    return (
      <GitDiffViewer
        filePath={diffFilePath}
        diff={diffContent}
        loading={diffLoading}
        onBack={handleBack}
      />
    );
  }

  // Normal mode: viewing file content
  if (viewMode === 'normal' && selectedFile) {
    return (
      <FileViewer
        filePath={selectedFile}
        onBack={handleBack}
      />
    );
  }

  // Git mode: show changed files list
  if (viewMode === 'git') {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Git Changes</Text>
          {renderModeToggle()}
        </View>
        <GitFileList
          files={gitFiles}
          loading={gitLoading}
          onFilePress={handleGitFilePress}
          onRefresh={handleGitRefresh}
        />
      </View>
    );
  }

  // Normal mode: show file tree
  return (
    <View style={styles.container}>
      {renderPathModal()}
      {currentPath.length === 0 && (
        <View style={styles.topBar}>
          <TouchableOpacity 
            onPress={() => setShowPathModal(true)}
            activeOpacity={0.7}
            style={styles.pathButton}
          >
            <Text style={styles.topBarTitle}>Files ▾</Text>
            <Text style={styles.pathText} numberOfLines={1}>
              {rootPath || 'Root'}
            </Text>
          </TouchableOpacity>
          {renderModeToggle()}
        </View>
      )}
      {viewMode === 'normal' && renderWarningBanner()}
      <FileTree
        tree={fileTree}
        currentPath={currentPath}
        onFileSelect={handleFileSelect}
        onBack={handleBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.body,
    color: colors.text.secondary,
  },
  errorText: {
    fontSize: typography.size.body,
    color: colors.error,
    textAlign: 'center',
    padding: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.secondary,
  },
  topBarTitle: {
    fontSize: typography.size.headline,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  pathButton: {
    flex: 1,
    marginRight: spacing.md,
  },
  pathText: {
    fontSize: typography.size.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  modeToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: typography.size.headline,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.size.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: typography.size.body,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  modalButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  cancelButton: {
    backgroundColor: colors.background.secondary,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },
  confirmButtonText: {
    color: colors.text.inverse,
    fontWeight: typography.weight.semibold,
  },
  modeToggleText: {
    color: colors.text.inverse,
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.semibold,
  },
  warningBanner: {
    backgroundColor: colors.background.tertiary || '#FFF3CD',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.secondary,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  warningIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: typography.size.caption,
    color: colors.text.secondary,
  },
});
