#[cfg(test)]
mod tests {
    use crate::{CanSocketWrapper, NEXT_ID, SOCKET_REGISTRY};
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;

    /// Test helper pour créer une interface virtuelle CAN
    #[cfg(target_os = "linux")]
    fn setup_vcan_interface() -> String {
        let interface = "vcan0"; // Utiliser interface existante

        // Vérifier que l'interface existe et est active
        let output = std::process::Command::new("ip")
            .args(&["link", "show", interface])
            .output()
            .expect("Failed to check vcan interface");

        if !output.status.success() {
            // Si vcan0 n'existe pas, essayer de la créer
            let create_output = std::process::Command::new("sudo")
                .args(&["ip", "link", "add", "dev", interface, "type", "vcan"])
                .output();

            if let Ok(create_result) = create_output {
                if create_result.status.success() {
                    // Activer l'interface nouvellement créée
                    let _ = std::process::Command::new("sudo")
                        .args(&["ip", "link", "set", "up", interface])
                        .output();
                }
            }
        }

        interface.to_string()
    }

    #[cfg(target_os = "linux")]
    fn cleanup_vcan_interface(_interface: &str) {
        // Ne plus supprimer l'interface car elle est partagée
        // Les interfaces vcan0 et vcan_test restent disponibles pour tous les tests
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_create_regular_can_socket() {
        let interface = setup_vcan_interface();

        let result = CanSocketWrapper::new(interface.clone());
        assert!(
            result.is_ok(),
            "Should create regular CAN socket successfully"
        );

        if let Ok(wrapper) = result {
            match wrapper {
                CanSocketWrapper::Regular(_) => {
                    // Test passed
                }
                _ => panic!("Expected Regular socket"),
            }
        }

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_create_can_fd_socket() {
        let interface = setup_vcan_interface();

        let result = CanSocketWrapper::new_fd(interface.clone());
        assert!(result.is_ok(), "Should create CAN FD socket successfully");

        if let Ok(wrapper) = result {
            match wrapper {
                CanSocketWrapper::Fd(_) => {
                    // Test passed
                }
                _ => panic!("Expected FD socket"),
            }
        }

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_send_and_receive_standard_frame() {
        let interface = setup_vcan_interface();

        let sender = CanSocketWrapper::new(interface.clone()).expect("Failed to create sender");
        let receiver = CanSocketWrapper::new(interface.clone()).expect("Failed to create receiver");

        let test_id = 0x123;
        let test_data = vec![0x01, 0x02, 0x03, 0x04];

        // Envoyer une frame
        let send_result = sender.send_frame(test_id, test_data.clone(), false, false, false);
        assert!(send_result.is_ok(), "Should send frame successfully");

        // Recevoir la frame avec timeout
        let receive_result = receiver.read_frame(Some(1000));
        assert!(receive_result.is_ok(), "Should receive frame successfully");

        let (received_id, received_data, extended, is_fd, is_remote, is_error) =
            receive_result.unwrap();
        assert_eq!(received_id, test_id, "Received ID should match sent ID");
        assert_eq!(
            received_data, test_data,
            "Received data should match sent data"
        );
        assert!(!extended, "Should not be extended frame");
        assert!(!is_fd, "Should not be FD frame");
        assert!(!is_remote, "Should not be remote frame");
        assert!(!is_error, "Should not be error frame");

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_send_and_receive_extended_frame() {
        let interface = setup_vcan_interface();

        let sender = CanSocketWrapper::new(interface.clone()).expect("Failed to create sender");
        let receiver = CanSocketWrapper::new(interface.clone()).expect("Failed to create receiver");

        let test_id = 0x12345678;
        let test_data = vec![0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22];

        // Envoyer une frame étendue
        let send_result = sender.send_frame(test_id, test_data.clone(), true, false, false);
        assert!(
            send_result.is_ok(),
            "Should send extended frame successfully"
        );

        // Recevoir la frame
        let receive_result = receiver.read_frame(Some(1000));
        assert!(
            receive_result.is_ok(),
            "Should receive extended frame successfully"
        );

        let (received_id, received_data, extended, is_fd, is_remote, is_error) =
            receive_result.unwrap();
        assert_eq!(received_id, test_id, "Received ID should match sent ID");
        assert_eq!(
            received_data, test_data,
            "Received data should match sent data"
        );
        assert!(extended, "Should be extended frame");
        assert!(!is_fd, "Should not be FD frame");
        assert!(!is_remote, "Should not be remote frame");
        assert!(!is_error, "Should not be error frame");

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_send_and_receive_remote_frame() {
        let interface = setup_vcan_interface();

        let sender = CanSocketWrapper::new(interface.clone()).expect("Failed to create sender");
        let receiver = CanSocketWrapper::new(interface.clone()).expect("Failed to create receiver");

        let test_id = 0x456;
        let test_data = vec![]; // Remote frame has no data

        // Envoyer une remote frame
        let send_result = sender.send_frame(test_id, test_data.clone(), false, false, true);
        assert!(send_result.is_ok(), "Should send remote frame successfully");

        // Recevoir la frame
        let receive_result = receiver.read_frame(Some(1000));
        assert!(
            receive_result.is_ok(),
            "Should receive remote frame successfully"
        );

        let (received_id, received_data, extended, is_fd, is_remote, is_error) =
            receive_result.unwrap();
        assert_eq!(received_id, test_id, "Received ID should match sent ID");
        assert_eq!(received_data, vec![], "Remote frame should have no data");
        assert!(!extended, "Should not be extended frame");
        assert!(!is_fd, "Should not be FD frame");
        assert!(is_remote, "Should be remote frame");
        assert!(!is_error, "Should not be error frame");

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_can_fd_frame() {
        let interface = setup_vcan_interface();

        let sender =
            CanSocketWrapper::new_fd(interface.clone()).expect("Failed to create FD sender");
        let receiver =
            CanSocketWrapper::new_fd(interface.clone()).expect("Failed to create FD receiver");

        let test_id = 0x789;
        let test_data = vec![
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E,
            0x0F, 0x10,
        ]; // 16 bytes (valid for FD)

        // Envoyer une frame FD
        let send_result = sender.send_frame(test_id, test_data.clone(), false, true, false);
        assert!(send_result.is_ok(), "Should send CAN FD frame successfully");

        // Recevoir la frame
        let receive_result = receiver.read_frame(Some(1000));
        assert!(
            receive_result.is_ok(),
            "Should receive CAN FD frame successfully"
        );

        let (received_id, received_data, extended, is_fd, is_remote, is_error) =
            receive_result.unwrap();
        assert_eq!(received_id, test_id, "Received ID should match sent ID");
        assert_eq!(
            received_data, test_data,
            "Received data should match sent data"
        );
        assert!(!extended, "Should not be extended frame");
        assert!(is_fd, "Should be FD frame");
        assert!(!is_remote, "Should not be remote frame");
        assert!(!is_error, "Should not be error frame");

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_can_filters() {
        let interface = setup_vcan_interface();

        let sender = CanSocketWrapper::new(interface.clone()).expect("Failed to create sender");
        let receiver = CanSocketWrapper::new(interface.clone()).expect("Failed to create receiver");

        // Définir un filtre pour accepter seulement l'ID 0x100
        let filters = vec![(0x100, 0x7FF, false)]; // Filtre exact pour ID 0x100
        let filter_result = receiver.set_filters(filters);
        assert!(filter_result.is_ok(), "Should set filters successfully");

        // Envoyer une frame avec l'ID filtré (devrait être reçue)
        let send_result = sender.send_frame(0x100, vec![0x01, 0x02], false, false, false);
        assert!(send_result.is_ok(), "Should send filtered frame");

        let receive_result = receiver.read_frame(Some(500));
        assert!(receive_result.is_ok(), "Should receive filtered frame");

        let (received_id, _, _, _, _, _) = receive_result.unwrap();
        assert_eq!(received_id, 0x100, "Should receive frame with filtered ID");

        // Envoyer une frame avec un ID non filtré (ne devrait pas être reçue)
        let send_result = sender.send_frame(0x200, vec![0x03, 0x04], false, false, false);
        assert!(send_result.is_ok(), "Should send non-filtered frame");

        // Cette réception devrait timeout
        let receive_result = receiver.read_frame(Some(500));
        assert!(
            receive_result.is_err(),
            "Should timeout on non-filtered frame"
        );

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_clear_filters() {
        let interface = setup_vcan_interface();

        let sender = CanSocketWrapper::new(interface.clone()).expect("Failed to create sender");
        let receiver = CanSocketWrapper::new(interface.clone()).expect("Failed to create receiver");

        // Définir un filtre restrictif
        let filters = vec![(0x100, 0x7FF, false)];
        let filter_result = receiver.set_filters(filters);
        assert!(filter_result.is_ok(), "Should set filters successfully");

        // Vérifier que seules les frames correspondant au filtre passent
        let send_result = sender.send_frame(0x200, vec![0x01, 0x02], false, false, false);
        assert!(send_result.is_ok(), "Should send frame");

        thread::sleep(Duration::from_millis(10));

        // Cette frame ne devrait pas passer le filtre (0x200 ne correspond pas à 0x100)
        let receive_result = receiver.read_frame(Some(100));
        assert!(
            receive_result.is_err(),
            "Should not receive frame that doesn't match filter"
        );

        // Effacer tous les filtres - utiliser un filtre permettant tout
        let all_filters = vec![(0x000, 0x000, false)]; // Filtre permettant tous les messages
        let clear_result = receiver.set_filters(all_filters);
        assert!(
            clear_result.is_ok(),
            "Should set permissive filters successfully"
        );

        // Maintenant toutes les frames devraient être reçues
        let send_result = sender.send_frame(0x200, vec![0x05, 0x06], false, false, false);
        assert!(send_result.is_ok(), "Should send frame");

        // Petit délai pour s'assurer que la frame est transmise
        thread::sleep(Duration::from_millis(10));

        let receive_result = receiver.read_frame(Some(500));
        assert!(
            receive_result.is_ok(),
            "Should receive frame after clearing filters"
        );

        let (received_id, _, _, _, _, _) = receive_result.unwrap();
        assert_eq!(received_id, 0x200, "Should receive frame with any ID");

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_timeout_behavior() {
        let interface = setup_vcan_interface();

        let receiver = CanSocketWrapper::new(interface.clone()).expect("Failed to create receiver");

        let start_time = std::time::Instant::now();
        let receive_result = receiver.read_frame(Some(500)); // 500ms timeout
        let elapsed = start_time.elapsed();

        assert!(
            receive_result.is_err(),
            "Should timeout when no frame is available"
        );
        assert!(
            elapsed.as_millis() >= 450,
            "Should wait approximately the timeout duration"
        );
        assert!(
            elapsed.as_millis() <= 600,
            "Should not wait much longer than timeout"
        );

        let error_msg = receive_result.unwrap_err().to_string();
        // Vérifier que c'est bien une erreur de timeout ou d'opération non bloquante
        assert!(
            error_msg.to_lowercase().contains("timeout")
                || error_msg.to_lowercase().contains("timed out")
                || error_msg.to_lowercase().contains("would block")
                || error_msg.to_lowercase().contains("no data"),
            "Error message should indicate timeout or no data available, got: {}",
            error_msg
        );

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_invalid_data_length() {
        let interface = setup_vcan_interface();

        let sender = CanSocketWrapper::new(interface.clone()).expect("Failed to create sender");

        // Tester l'envoi de données trop longues pour CAN regular (> 8 bytes)
        let long_data = vec![0; 10]; // 10 bytes, trop long pour CAN standard
        let send_result = sender.send_frame(0x123, long_data, false, false, false);
        assert!(
            send_result.is_err(),
            "Should fail to send frame with data > 8 bytes"
        );

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_invalid_can_id_ranges() {
        let interface = setup_vcan_interface();

        let sender = CanSocketWrapper::new(interface.clone()).expect("Failed to create sender");

        // Tester un ID standard invalide (> 0x7FF)
        let invalid_std_id = 0x800; // Trop grand pour standard (11-bit)
        let send_result = sender.send_frame(invalid_std_id, vec![0x01], false, false, false);
        assert!(
            send_result.is_err(),
            "Should fail with invalid standard CAN ID"
        );

        // Tester un ID étendu valide
        let valid_ext_id = 0x12345678;
        let send_result = sender.send_frame(valid_ext_id, vec![0x01], true, false, false);
        assert!(
            send_result.is_ok(),
            "Should succeed with valid extended CAN ID"
        );

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_socket_close() {
        let interface = setup_vcan_interface();

        let socket = CanSocketWrapper::new(interface.clone()).expect("Failed to create socket");

        // Fermer le socket
        let close_result = socket.close();
        assert!(close_result.is_ok(), "Should close socket successfully");

        cleanup_vcan_interface(&interface);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_concurrent_operations() {
        let interface = setup_vcan_interface();

        let sender: Arc<CanSocketWrapper> =
            Arc::new(CanSocketWrapper::new(interface.clone()).expect("Failed to create sender"));
        let receiver: Arc<CanSocketWrapper> =
            Arc::new(CanSocketWrapper::new(interface.clone()).expect("Failed to create receiver"));

        let sender_clone: Arc<CanSocketWrapper> = Arc::clone(&sender);
        let receiver_clone: Arc<CanSocketWrapper> = Arc::clone(&receiver);

        // Thread d'envoi
        let send_handle = thread::spawn(move || {
            for i in 0..10 {
                let data = vec![i as u8];
                let result = sender_clone.send_frame(0x100 + i as u32, data, false, false, false);
                assert!(result.is_ok(), "Should send frame in thread");
                thread::sleep(Duration::from_millis(10));
            }
        });

        // Thread de réception
        let receive_handle = thread::spawn(move || {
            let mut received_count = 0;
            while received_count < 10 {
                if let Ok(_) = receiver_clone.read_frame(Some(1000)) {
                    received_count += 1;
                }
            }
            assert_eq!(received_count, 10, "Should receive all sent frames");
        });

        send_handle.join().expect("Send thread should complete");
        receive_handle
            .join()
            .expect("Receive thread should complete");

        cleanup_vcan_interface(&interface);
    }

    // Tests pour les stubs non-Linux
    #[test]
    #[cfg(not(target_os = "linux"))]
    fn test_non_linux_stubs() {
        let wrapper = CanSocketWrapper::new("test".to_string()).expect("Should create stub");

        // Toutes les opérations devraient échouer avec un message approprié
        let send_result = wrapper.send_frame(0x123, vec![0x01], false, false, false);
        assert!(send_result.is_err());
        assert!(send_result.unwrap_err().to_string().contains("Linux"));

        let read_result = wrapper.read_frame(Some(1000));
        assert!(read_result.is_err());
        assert!(read_result.unwrap_err().to_string().contains("Linux"));

        let filter_result = wrapper.set_filters(vec![(0x100, 0x7FF, false)]);
        assert!(filter_result.is_err());
        assert!(filter_result.unwrap_err().to_string().contains("Linux"));

        let clear_result = wrapper.clear_filters();
        assert!(clear_result.is_err());
        assert!(clear_result.unwrap_err().to_string().contains("Linux"));

        // Close devrait fonctionner même sur non-Linux
        let close_result = wrapper.close();
        assert!(close_result.is_ok());
    }

    #[test]
    fn test_socket_registry_operations() {
        // Tester que les opérations de registre fonctionnent
        let mut next_id = NEXT_ID.lock().unwrap();
        let current_id = *next_id;
        *next_id += 1;
        drop(next_id);

        // Vérifier que l'ID a été incrémenté
        let new_id = *NEXT_ID.lock().unwrap();
        assert_eq!(new_id, current_id + 1, "ID should be incremented");

        // Tester l'insertion et la suppression du registre
        let mut registry = SOCKET_REGISTRY.lock().unwrap();
        let initial_size = registry.len();

        #[cfg(target_os = "linux")]
        {
            if let Ok(wrapper) = CanSocketWrapper::new("test".to_string()) {
                registry.insert(999, wrapper);
                assert_eq!(registry.len(), initial_size + 1, "Registry should grow");

                registry.remove(&999);
                assert_eq!(registry.len(), initial_size, "Registry should shrink");
            }
        }

        #[cfg(not(target_os = "linux"))]
        {
            let wrapper = CanSocketWrapper::new("test".to_string()).expect("Should create stub");
            registry.insert(999, wrapper);
            assert_eq!(registry.len(), initial_size + 1, "Registry should grow");

            registry.remove(&999);
            assert_eq!(registry.len(), initial_size, "Registry should shrink");
        }
    }
}
